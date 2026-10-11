"""
Feedstock Characterization Module
=================================
Models medical waste composition using proximate and ultimate analysis.

Reference values based on typical medical waste literature:
- Proximate analysis: Moisture, Volatile Matter, Fixed Carbon, Ash
- Ultimate analysis (dry basis): C, H, O, N, S, Cl, Ash

Equations:
  HHV (Dulong) ≈ 33.83·C + 144.3·(H - O/8) + 9.42·S  [MJ/kg, dry basis]
  LHV = HHV - 2.442 · (9·H + M/(1-M))  [MJ/kg]

References:
  - Dulong's formula for heating value estimation
  - WHO guidelines on medical waste composition
"""

from dataclasses import dataclass, field
from typing import Optional
import math


@dataclass
class ProximateAnalysis:
    """Proximate analysis of waste feedstock (weight %)."""
    moisture: float = 15.0
    volatile_matter: float = 70.0
    fixed_carbon: float = 10.0
    ash: float = 5.0

    def validate(self) -> list[str]:
        errors = []
        for name, val in [("moisture", self.moisture), ("volatile_matter", self.volatile_matter),
                          ("fixed_carbon", self.fixed_carbon), ("ash", self.ash)]:
            if val < 0:
                errors.append(f"{name} cannot be negative: {val}")
            if val > 100:
                errors.append(f"{name} cannot exceed 100%: {val}")
        total = self.moisture + self.volatile_matter + self.fixed_carbon + self.ash
        if abs(total - 100.0) > 1.0:
            errors.append(f"Proximate analysis must sum to ~100%, got {total:.2f}%")
        return errors

    @property
    def total(self) -> float:
        return self.moisture + self.volatile_matter + self.fixed_carbon + self.ash


@dataclass
class UltimateAnalysis:
    """Ultimate analysis of waste feedstock, dry basis (weight %)."""
    carbon: float = 54.0
    hydrogen: float = 5.5
    oxygen: float = 32.0
    nitrogen: float = 1.5
    sulfur: float = 0.2
    chlorine: float = 0.8
    ash: float = 5.0

    def validate(self) -> list[str]:
        errors = []
        for name, val in [("carbon", self.carbon), ("hydrogen", self.hydrogen),
                          ("oxygen", self.oxygen), ("nitrogen", self.nitrogen),
                          ("sulfur", self.sulfur), ("chlorine", self.chlorine),
                          ("ash", self.ash)]:
            if val < 0:
                errors.append(f"{name} cannot be negative: {val}")
            if val > 100:
                errors.append(f"{name} cannot exceed 100%: {val}")
        # Allow chlorine + ash flexibility; sum should still be ~100
        total = self.carbon + self.hydrogen + self.oxygen + self.nitrogen + self.sulfur + self.chlorine + self.ash
        # Remaining is implicitly accounted for
        if total < 0:
            errors.append(f"Ultimate analysis total is negative: {total}")
        if abs(total - 100.0) > 2.0:
            errors.append(f"Ultimate analysis should sum to ~100% (dry basis), got {total:.2f}%")
        return errors

    @property
    def total(self) -> float:
        return self.carbon + self.hydrogen + self.oxygen + self.nitrogen + self.sulfur + self.chlorine + self.ash


@dataclass
class WasteComposition:
    """Waste stream composition fractions (weight %)."""
    plastic_fraction: float = 20.0
    organic_fraction: float = 50.0
    glass_fraction: float = 10.0
    infectious_fraction: float = 20.0

    def validate(self) -> list[str]:
        errors = []
        for name, val in [("plastic_fraction", self.plastic_fraction),
                          ("organic_fraction", self.organic_fraction),
                          ("glass_fraction", self.glass_fraction),
                          ("infectious_fraction", self.infectious_fraction)]:
            if val < 0:
                errors.append(f"{name} cannot be negative: {val}")
            if val > 100:
                errors.append(f"{name} cannot exceed 100%: {val}")
        total = self.plastic_fraction + self.organic_fraction + self.glass_fraction + self.infectious_fraction
        if abs(total - 100.0) > 1.0:
            errors.append(f"Waste composition must sum to ~100%, got {total:.2f}%")
        return errors


@dataclass
class FeedstockConfig:
    """Complete feedstock configuration."""
    mass_flow_kg_h: float = 500.0  # kg/h waste feed rate
    proximate: ProximateAnalysis = field(default_factory=ProximateAnalysis)
    ultimate: UltimateAnalysis = field(default_factory=UltimateAnalysis)
    composition: WasteComposition = field(default_factory=WasteComposition)

    def validate(self) -> list[str]:
        errors = []
        if self.mass_flow_kg_h <= 0:
            errors.append(f"Mass flow must be positive: {self.mass_flow_kg_h}")
        if self.mass_flow_kg_h > 10000:
            errors.append(f"Mass flow exceeds reasonable range: {self.mass_flow_kg_h} kg/h")
        errors.extend(self.proximate.validate())
        errors.extend(self.ultimate.validate())
        errors.extend(self.composition.validate())
        return errors


@dataclass
class FeedstockResult:
    """Feedstock characterization results."""
    dry_mass_flow_kg_h: float = 0.0
    moisture_flow_kg_h: float = 0.0
    volatile_flow_kg_h: float = 0.0
    fixed_carbon_flow_kg_h: float = 0.0
    ash_flow_kg_h: float = 0.0
    hhv_mj_kg: float = 0.0  # Higher heating value, dry basis
    lhv_mj_kg: float = 0.0  # Lower heating value, as-received
    chemical_energy_kw: float = 0.0  # Total chemical energy input
    elemental_flows: dict = field(default_factory=dict)  # kg/h of each element
    valid: bool = True
    errors: list = field(default_factory=list)


def calculate_feedstock(config: FeedstockConfig) -> FeedstockResult:
    """
    Calculate feedstock properties from waste composition.

    Steps:
    1. Validate inputs
    2. Calculate mass flows for each proximate component
    3. Calculate elemental flows from ultimate analysis
    4. Estimate heating value using Dulong's formula
    5. Calculate total chemical energy input

    Dulong's formula (MJ/kg, dry basis):
        HHV = 33.83·C + 144.3·(H - O/8) + 9.42·S
        where C, H, O, S are mass fractions (0-1)

    LHV approximation:
        LHV = HHV - 2.442 × (9·H + M/(1-M))
        where H is dry-basis hydrogen fraction, M is moisture fraction
    """
    result = FeedstockResult()
    errors = config.validate()
    if errors:
        result.valid = False
        result.errors = errors
        return result

    m = config.mass_flow_kg_h
    prox = config.proximate
    ult = config.ultimate

    # Mass flows from proximate analysis
    result.moisture_flow_kg_h = m * prox.moisture / 100.0
    result.dry_mass_flow_kg_h = m * (1.0 - prox.moisture / 100.0)
    result.volatile_flow_kg_h = m * prox.volatile_matter / 100.0
    result.fixed_carbon_flow_kg_h = m * prox.fixed_carbon / 100.0
    result.ash_flow_kg_h = m * prox.ash / 100.0

    # Elemental flows (from ultimate, applied to dry mass)
    dry_mass = result.dry_mass_flow_kg_h
    result.elemental_flows = {
        "C": dry_mass * ult.carbon / 100.0,
        "H": dry_mass * ult.hydrogen / 100.0,
        "O": dry_mass * ult.oxygen / 100.0,
        "N": dry_mass * ult.nitrogen / 100.0,
        "S": dry_mass * ult.sulfur / 100.0,
        "Cl": dry_mass * ult.chlorine / 100.0,
        "Ash": dry_mass * ult.ash / 100.0,
    }

    # Dulong's formula for HHV (MJ/kg, dry basis)
    c_frac = ult.carbon / 100.0
    h_frac = ult.hydrogen / 100.0
    o_frac = ult.oxygen / 100.0
    s_frac = ult.sulfur / 100.0

    result.hhv_mj_kg = 33.83 * c_frac + 144.3 * (h_frac - o_frac / 8.0) + 9.42 * s_frac

    # Ensure HHV is not negative (can happen with very high oxygen content)
    if result.hhv_mj_kg < 0:
        result.hhv_mj_kg = 0.0

    # LHV approximation (as-received basis)
    moisture_frac = prox.moisture / 100.0
    if moisture_frac < 1.0:
        latent_correction = 2.442 * (9.0 * h_frac + moisture_frac / (1.0 - moisture_frac))
    else:
        latent_correction = 0.0
    result.lhv_mj_kg = max(0.0, result.hhv_mj_kg - latent_correction)

    # Chemical energy input (kW)
    # Energy = mass_flow (kg/h) * LHV (MJ/kg) * (1000/3600) to convert MJ/h to kW
    result.chemical_energy_kw = m * result.lhv_mj_kg * 1000.0 / 3600.0

    return result
