"""
Fluidized-Bed Gasification Model
=================================
Simplified gasification simulation for medical waste conversion.

This module implements an RGibbs-like simplified equilibrium model for
gasification of medical waste in a fluidized-bed reactor.

Key assumptions:
1. Partial equilibrium approach - not full Gibbs minimization
2. Air is used as the gasifying agent
3. Carbon conversion efficiency is temperature-dependent
4. Product gas composition estimated from elemental balance + empirical correlations
5. Equivalence ratio (ER) is the primary control parameter

Equations:
  ER = (actual air) / (stoichiometric air for complete combustion)
  Stoichiometric O2 = C/12 + H/4 - O/32 + S/32  [kmol/kg fuel]
  
  Carbon conversion: η_C = min(0.99, 0.6 + 0.4 × (T-600)/400) for T in °C
  
  Gas composition estimated from:
    - Water-gas shift equilibrium: CO + H2O ⇌ CO2 + H2
    - Boudouard reaction: C + CO2 ⇌ 2CO
    - Methane formation: C + 2H2 ⇌ CH4 (minor)
  
  Syngas LHV = Σ(yi × LHVi) for each combustible species

References:
  - Basu, P. "Biomass Gasification, Pyrolysis and Torrefaction"
  - Arena, U. "Process and technological aspects of municipal solid waste gasification"
"""

from dataclasses import dataclass, field
from typing import Optional
import math


@dataclass
class GasifierConfig:
    """Gasifier operating configuration."""
    waste_feed_kg_h: float = 500.0
    moisture_pct: float = 15.0
    airflow_m3_h: float = 120.0
    reactor_temp_c: float = 850.0
    pressure_kpa: float = 101.325  # atmospheric
    plastic_ratio: float = 0.20
    organic_ratio: float = 0.50
    ash_fraction: float = 0.05
    # Elemental composition (dry basis, mass fractions)
    carbon: float = 0.54
    hydrogen: float = 0.055
    oxygen: float = 0.32
    nitrogen: float = 0.015
    sulfur: float = 0.002
    chlorine: float = 0.008
    # Computed feedstock LHV (MJ/kg, dry basis or as-received)
    feedstock_lhv_mj_kg: Optional[float] = None


@dataclass
class GasificationResult:
    """Gasification simulation results."""
    gas_mass_flow_kg_h: float = 0.0
    gas_composition: dict = field(default_factory=dict)  # mole fractions
    char_ash_kg_h: float = 0.0
    thermal_energy_kw: float = 0.0
    gasification_efficiency: float = 0.0
    syngas_lhv_mj_nm3: float = 0.0
    carbon_conversion: float = 0.0
    equivalence_ratio: float = 0.0
    syngas_flow_nm3_h: float = 0.0
    bed_temperature_c: float = 0.0
    air_density_kg_m3: float = 0.0
    air_viscosity_pa_s: float = 0.0
    valid: bool = True
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


def calculate_gasification(config: GasifierConfig) -> GasificationResult:
    """
    Run simplified gasification model.
    
    Process:
    1. Calculate dry fuel mass and elemental inputs
    2. Calculate stoichiometric air requirement
    3. Calculate equivalence ratio
    4. Estimate carbon conversion based on temperature
    5. Perform elemental balance to estimate gas composition
    6. Calculate syngas properties and thermal output
    """
    result = GasificationResult()
    
    # Validate inputs
    if config.waste_feed_kg_h <= 0:
        result.valid = False
        result.errors.append("Waste feed rate must be positive")
        return result
    if config.reactor_temp_c < 400:
        result.warnings.append("Temperature below typical gasification range")
    if config.reactor_temp_c > 1200:
        result.warnings.append("Temperature above typical gasification range")
    
    # Step 1: Dry fuel properties
    moisture_frac = config.moisture_pct / 100.0
    dry_fuel_kg_h = config.waste_feed_kg_h * (1.0 - moisture_frac)
    water_in_kg_h = config.waste_feed_kg_h * moisture_frac
    
    # Elemental inputs (kg/h)
    c_in = dry_fuel_kg_h * config.carbon
    h_in = dry_fuel_kg_h * config.hydrogen
    o_in = dry_fuel_kg_h * config.oxygen
    n_in = dry_fuel_kg_h * config.nitrogen
    s_in = dry_fuel_kg_h * config.sulfur
    ash_in = dry_fuel_kg_h * config.ash_fraction
    
    # Step 2: Stoichiometric air calculation
    # O2 required for complete combustion (kg/h)
    # C + O2 → CO2: 1 mol C needs 1 mol O2
    # H2 + 0.5O2 → H2O: 1 mol H2 needs 0.5 mol O2
    # S + O2 → SO2: 1 mol S needs 1 mol O2
    o2_stoich_kg_h = (c_in * 32/12) + (h_in * 16/2) - o_in + (s_in * 32/32)
    o2_stoich_kg_h = max(0.0, o2_stoich_kg_h)
    
    # Air input:
    # ASSUMPTION: config.airflow_m3_h is interpreted at normal conditions (0 °C, 101.325 kPa).
    # Convert to actual volumetric flow at bed temperature and pressure:
    temp = config.reactor_temp_c
    t_kelvin = temp + 273.15
    p_pa = config.pressure_kpa * 1000.0
    r_air = 287.058  # J/(kg·K) specific gas constant for air

    # Temperature-dependent air density at bed conditions via Ideal Gas Law (kg/m³):
    air_density = p_pa / (r_air * t_kelvin)
    result.air_density_kg_m3 = air_density

    # Dynamic viscosity of air at bed temperature via Sutherland's law (Pa·s):
    # Source: White (2006); Crane TP 410 (mu_ref = 1.716e-5 Pa·s at 273.15 K, S = 110.4 K)
    air_viscosity = 1.716e-5 * ((t_kelvin / 273.15) ** 1.5) * ((273.15 + 110.4) / (t_kelvin + 110.4))
    result.air_viscosity_pa_s = air_viscosity

    # Actual volumetric flow rate at reactor conditions (m³/h):
    actual_airflow_m3_h = config.airflow_m3_h * (t_kelvin / 273.15) * (101.325 / config.pressure_kpa)

    # Air mass flow rate (kg/h): actual volumetric flow * temperature-dependent actual density
    air_mass_kg_h = actual_airflow_m3_h * air_density
    o2_in_kg_h = air_mass_kg_h * 0.233  # 23.3% O2 by mass
    n2_in_kg_h = air_mass_kg_h * 0.767  # rest is N2
    
    # Step 3: Equivalence ratio
    if o2_stoich_kg_h > 0:
        result.equivalence_ratio = o2_in_kg_h / o2_stoich_kg_h
    else:
        result.equivalence_ratio = 0.0
    
    # Step 4: Carbon conversion (temperature dependent)
    # Higher temperature → higher conversion
    # Plastic content increases volatile yield
    base_conversion = min(0.99, max(0.3, 0.6 + 0.4 * (temp - 600) / 400))
    
    # Plastic increases conversion slightly (more volatiles)
    plastic_boost = config.plastic_ratio * 0.1
    carbon_conversion = min(0.99, base_conversion + plastic_boost)
    
    # High moisture reduces conversion
    moisture_penalty = moisture_frac * 0.15
    carbon_conversion = max(0.1, carbon_conversion - moisture_penalty)
    
    result.carbon_conversion = carbon_conversion
    
    # Step 5: Gas composition estimation
    # Carbon that reacts
    c_reacted = c_in * carbon_conversion
    c_unreacted = c_in * (1.0 - carbon_conversion)
    
    # Convert to moles (kmol/h)
    c_mol = c_reacted / 12.0
    h_mol = h_in / 2.0  # H2 moles
    o_mol_fuel = o_in / 32.0  # O2-equivalent from fuel
    o_mol_air = o2_in_kg_h / 32.0
    n_mol_fuel = n_in / 28.0
    n_mol_air = n2_in_kg_h / 28.0
    h2o_mol = water_in_kg_h / 18.0  # water from moisture
    
    total_o_mol = o_mol_fuel + o_mol_air  # total O2 moles available
    
    # Simplified gas composition model based on ER and temperature
    # At ER < 0.5 (gasification range), we get more CO and H2
    er = result.equivalence_ratio
    
    # Distribution of carbon products before water-gas shift
    # CO fraction increases with temperature and decreases with ER
    co_fraction = min(0.7, max(0.1, 0.5 * (1.0 - er) + 0.2 * (temp - 700) / 300))
    co2_fraction = 1.0 - co_fraction
    
    n_co_0 = c_mol * co_fraction
    n_co2_0 = c_mol * co2_fraction
    n_h2_0 = h_mol
    n_h2o_0 = h2o_mol

    # Water-gas shift equilibrium constant (K_wgs)
    # Reaction: CO + H2O <=> CO2 + H2
    # Equilibrium constant correlation: K_wgs = exp(4577.8/T - 4.33), T in Kelvin
    # Source: Boreskov et al.; Twigg (1989), Catalyst Handbook
    k_wgs = math.exp(4577.8 / t_kelvin - 4.33)

    # Equilibrium condition:
    # (n_co2_0 + xi) * (n_h2_0 + xi) = K_wgs * (n_co_0 - xi) * (n_h2o_0 - xi)
    # Quadratic: a_wgs * xi² + b_wgs * xi + c_wgs = 0
    # a_wgs = (1.0 - k_wgs)
    # b_wgs = (n_co2_0 + n_h2_0) + k_wgs * (n_co_0 + n_h2o_0)
    # c_wgs = (n_co2_0 * n_h2_0) - k_wgs * (n_co_0 * n_h2o_0)
    a_wgs = 1.0 - k_wgs
    b_wgs = (n_co2_0 + n_h2_0) + k_wgs * (n_co_0 + n_h2o_0)
    c_wgs = (n_co2_0 * n_h2_0) - k_wgs * (n_co_0 * n_h2o_0)

    # Solve for equilibrium shift extent xi_eq
    if abs(a_wgs) < 1e-6:
        xi_eq = -c_wgs / b_wgs if abs(b_wgs) > 1e-9 else 0.0
    else:
        disc = b_wgs * b_wgs - 4.0 * a_wgs * c_wgs
        if disc >= 0.0:
            sqrt_disc = math.sqrt(disc)
            xi_r1 = (-b_wgs + sqrt_disc) / (2.0 * a_wgs)
            xi_r2 = (-b_wgs - sqrt_disc) / (2.0 * a_wgs)
            max_forward = min(n_co_0, n_h2o_0)
            max_reverse = min(n_co2_0, n_h2_0)
            candidates = [r for r in [xi_r1, xi_r2] if -max_reverse <= r <= max_forward]
            xi_eq = candidates[0] if candidates else 0.0
        else:
            xi_eq = 0.0

    # ASSUMPTION: 80% approach to equilibrium (alpha_wgs = 0.80) due to finite residence time
    alpha_wgs = 0.80
    shift_extent = xi_eq * alpha_wgs

    # Clamp shift extent so species moles remain non-negative
    shift_extent = max(-0.95 * min(n_co2_0, n_h2_0), min(0.95 * min(n_co_0, n_h2o_0), shift_extent))

    n_co = max(0.0, n_co_0 - shift_extent)
    n_co2 = max(0.0, n_co2_0 + shift_extent)
    n_h2 = max(0.0, n_h2_0 + shift_extent)
    n_h2o_out = max(0.0, n_h2o_0 - shift_extent)
    
    # Nitrogen (from fuel + air)
    n_n2 = n_mol_fuel + n_mol_air
    
    # Remaining oxygen
    o2_consumed = n_co * 0.5 + n_co2 * 1.0  # O2 used in combustion
    n_o2_out = max(0, total_o_mol - o2_consumed) * 0.05  # small residual
    
    # Ensure no negative values
    n_co = max(0, n_co)
    n_co2 = max(0, n_co2)
    n_h2 = max(0, n_h2)
    n_h2o_out = max(0, n_h2o_out)
    n_n2 = max(0, n_n2)
    n_o2_out = max(0, n_o2_out)
    
    # Total gas moles
    total_mol = n_co + n_co2 + n_h2 + n_h2o_out + n_n2 + n_o2_out
    
    if total_mol > 0:
        result.gas_composition = {
            "CO": n_co / total_mol,
            "CO2": n_co2 / total_mol,
            "H2": n_h2 / total_mol,
            "H2O": n_h2o_out / total_mol,
            "N2": n_n2 / total_mol,
            "O2": n_o2_out / total_mol,
        }
    else:
        result.gas_composition = {"CO": 0, "CO2": 0, "H2": 0, "H2O": 0, "N2": 0, "O2": 0}
    
    # Step 6: Gas mass flow
    # M_gas = Σ(ni × Mi)
    molar_masses = {"CO": 28, "CO2": 44, "H2": 2, "H2O": 18, "N2": 28, "O2": 32}
    gas_mass_mol = sum(
        result.gas_composition.get(sp, 0) * molar_masses[sp]
        for sp in molar_masses
    )
    
    # Gas mass flow (kg/h)
    result.gas_mass_flow_kg_h = total_mol * gas_mass_mol
    
    # Syngas volumetric flow at NTP (Nm³/h)
    # 1 kmol = 22.4 Nm³
    result.syngas_flow_nm3_h = total_mol * 22.4
    
    # Char/ash output
    result.char_ash_kg_h = c_unreacted + ash_in + s_in * 0.5
    
    # Step 7: Syngas LHV
    # LHV values (MJ/Nm³): CO=12.63, H2=10.78, CH4=35.88
    co_vol_frac = result.gas_composition.get("CO", 0)
    h2_vol_frac = result.gas_composition.get("H2", 0)
    result.syngas_lhv_mj_nm3 = 12.63 * co_vol_frac + 10.78 * h2_vol_frac
    
    # Thermal energy from syngas (kW)
    result.thermal_energy_kw = result.syngas_flow_nm3_h * result.syngas_lhv_mj_nm3 * 1000 / 3600
    
    # Gasification efficiency (cold gas efficiency)
    # Use computed feedstock LHV when provided, falling back to 15.0 MJ/kg
    feedstock_lhv = config.feedstock_lhv_mj_kg if config.feedstock_lhv_mj_kg is not None else 15.0
    chemical_input_kw = config.waste_feed_kg_h * feedstock_lhv * 1000.0 / 3600.0
    if chemical_input_kw > 0:
        result.gasification_efficiency = min(0.95, result.thermal_energy_kw / chemical_input_kw)
    
    result.bed_temperature_c = config.reactor_temp_c
    
    return result
