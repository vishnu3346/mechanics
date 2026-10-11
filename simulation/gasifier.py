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
    
    # Step 4: Carbon conversion (temperature, volatiles, moisture, and ER kinetics)
    # Base potential conversion based on bed temperature
    # Higher temperature -> higher volatile release and reaction rates
    base_conversion = min(0.99, max(0.3, 0.6 + 0.4 * (temp - 600) / 400))
    
    # Plastic content increases volatile yield
    plastic_boost = config.plastic_ratio * 0.1
    pot_conversion = min(0.99, base_conversion + plastic_boost)
    
    # High moisture reduces bed temperature and reaction kinetics
    moisture_penalty = moisture_frac * 0.15
    pot_conversion = max(0.1, pot_conversion - moisture_penalty)
    
    # ASSUMPTION: Heterogeneous char gasification and oxidation kinetics as a function of ER.
    # Uses two empirical constants:
    # 1. f_vol = F_VOLATILE_PYROLYSIS (0.65): baseline volatile carbon release fraction during fast devolatilization as ER -> 0.
    # 2. ER_ref = ER_CHAR_SCALE (0.18): characteristic equivalence ratio scale governing heterogeneous char oxidation kinetics.
    # This represents semi-empirical kinetics across equivalence ratios rather than an exact fundamental mechanism.
    F_VOLATILE_PYROLYSIS = 0.65
    ER_CHAR_SCALE = 0.18
    er = result.equivalence_ratio
    er_char_factor = min(1.0, F_VOLATILE_PYROLYSIS + (1.0 - F_VOLATILE_PYROLYSIS) * (1.0 - math.exp(-max(0.0, er) / ER_CHAR_SCALE)))
    carbon_conversion = pot_conversion * er_char_factor
    
    result.carbon_conversion = carbon_conversion
    
    # Step 5: Elemental conservation and gas composition
    # Moles in kmol/h
    # Dry fuel elemental components
    trace_solid = max(0.0, dry_fuel_kg_h - (c_in + h_in + o_in + n_in + s_in + ash_in))
    
    # Elemental moles entering gasifier
    total_o_atoms = 2.0 * (o_in / 31.999 + o2_in_kg_h / 31.999) + (water_in_kg_h / 18.015)
    total_h2_moles = (h_in / 2.016) + (water_in_kg_h / 18.015)
    n_n2 = (n_in + n2_in_kg_h) / 28.013
    
    # Carbon reacting: at extreme sub-stoichiometric ER, reacted carbon is bounded by available oxygen
    c_mol_avail = c_in / 12.011
    max_c_reacted = min(c_in * carbon_conversion, total_o_atoms * 12.011)
    c_reacted = max_c_reacted
    carbon_conversion = c_reacted / c_in if c_in > 0 else 0.0
    result.carbon_conversion = carbon_conversion
    
    c_unreacted = c_in - c_reacted
    c_mol = c_reacted / 12.011
    er = result.equivalence_ratio

    # Methane formation (pyrolysis volatiles from plastic and biomass devolatilization)
    ch4_frac = max(0.01, min(0.06, 0.035 * (1.0 + 0.5 * config.plastic_ratio) * max(0.2, 1.0 - 0.2 * er)))
    n_ch4 = c_mol * ch4_frac
    c_ox = max(0.0, c_mol - n_ch4)  # Carbon available for CO and CO2

    h_rem = max(0.0, total_h2_moles - 2.0 * n_ch4)
    delta_o = total_o_atoms - 2.0 * c_ox
    h_ox = h_rem - delta_o

    # Water-gas shift equilibrium constant (K_wgs)
    # Reaction: CO + H2O <=> CO2 + H2
    # Correlation: K_wgs = exp(4577.8/T - 4.33), T in Kelvin
    # Source: Boreskov et al.; Twigg (1989), Catalyst Handbook
    k_wgs = math.exp(4577.8 / t_kelvin - 4.33)

    # Solve quadratic for equilibrium CO extent:
    # (C_ox - n_co) * (H_ox - n_co) = K_wgs * n_co * (n_co + delta_o)
    # (1 - K_wgs) * n_co² - [(C_ox + H_ox) + K_wgs * delta_o] * n_co + C_ox * H_ox = 0
    a_wgs = 1.0 - k_wgs
    b_wgs = -((c_ox + h_ox) + k_wgs * delta_o)
    c_wgs = c_ox * h_ox

    if abs(a_wgs) < 1e-6:
        n_co_eq = -c_wgs / b_wgs if abs(b_wgs) > 1e-9 else c_ox * 0.5
    else:
        disc = b_wgs * b_wgs - 4.0 * a_wgs * c_wgs
        low_bound = max(0.0, -delta_o)
        high_bound = min(c_ox, h_ox) if h_ox > 0 else c_ox
        if disc >= 0.0:
            sqrt_disc = math.sqrt(disc)
            r1 = (-b_wgs + sqrt_disc) / (2.0 * a_wgs)
            r2 = (-b_wgs - sqrt_disc) / (2.0 * a_wgs)
            candidates = [r for r in [r1, r2] if low_bound <= r <= high_bound]
            n_co_eq = candidates[0] if candidates else max(low_bound, min(high_bound, r1))
        else:
            n_co_eq = max(low_bound, min(high_bound, c_ox * 0.5))

    # Kinetic approach to equilibrium (alpha_wgs = 0.85) due to finite residence time
    alpha_wgs = 0.85
    n_co_init = c_ox * min(0.85, max(0.15, 0.60 * (1.0 - 0.5 * er) + 0.20 * (temp - 700) / 300))
    low_bound = max(0.0, -delta_o)
    n_co = max(low_bound, min(c_ox, n_co_init + alpha_wgs * (n_co_eq - n_co_init)))

    n_co2 = max(0.0, c_ox - n_co)
    n_h2o = max(0.0, n_co + delta_o)
    n_h2 = max(0.0, h_rem - n_h2o)

    # Total gas moles (kmol/h)
    total_mol = n_co + n_co2 + n_h2 + n_h2o + n_ch4 + n_n2

    if total_mol > 0:
        result.gas_composition = {
            "CO": n_co / total_mol,
            "CO2": n_co2 / total_mol,
            "H2": n_h2 / total_mol,
            "CH4": n_ch4 / total_mol,
            "H2O": n_h2o / total_mol,
            "N2": n_n2 / total_mol,
            "O2": 0.0,
        }
    else:
        result.gas_composition = {"CO": 0, "CO2": 0, "H2": 0, "CH4": 0, "H2O": 0, "N2": 0, "O2": 0}

    # Step 6: Gas mass flow and solid residue
    molar_masses = {"CO": 28.01, "CO2": 44.01, "H2": 2.016, "CH4": 16.04, "H2O": 18.015, "N2": 28.013, "O2": 31.999}
    gas_mass_mol = sum(
        result.gas_composition.get(sp, 0.0) * molar_masses[sp]
        for sp in molar_masses
    )
    result.gas_mass_flow_kg_h = total_mol * gas_mass_mol

    # Syngas volumetric flow at NTP (Nm³/h) via standard molar volume (22.414 Nm³/kmol)
    result.syngas_flow_nm3_h = total_mol * 22.414

    # Char/ash output
    result.char_ash_kg_h = c_unreacted + ash_in + s_in + trace_solid

    # Step 7: Syngas LHV
    # Standard LHV values (MJ/Nm³): CO=12.63, H2=10.78, CH4=35.88
    co_vol_frac = result.gas_composition.get("CO", 0.0)
    h2_vol_frac = result.gas_composition.get("H2", 0.0)
    ch4_vol_frac = result.gas_composition.get("CH4", 0.0)
    result.syngas_lhv_mj_nm3 = 12.63 * co_vol_frac + 10.78 * h2_vol_frac + 35.88 * ch4_vol_frac

    # Thermal energy from syngas (kW)
    result.thermal_energy_kw = result.syngas_flow_nm3_h * result.syngas_lhv_mj_nm3 * 1000.0 / 3600.0

    # Gasification efficiency (cold gas efficiency)
    # Reference feedstock LHV fallback is 18.812 MJ/kg (consistent with standard feedstock proximate/ultimate analysis)
    feedstock_lhv = config.feedstock_lhv_mj_kg if config.feedstock_lhv_mj_kg is not None else 18.812
    chemical_input_kw = config.waste_feed_kg_h * feedstock_lhv * 1000.0 / 3600.0
    if chemical_input_kw > 0:
        result.gasification_efficiency = result.thermal_energy_kw / chemical_input_kw

    result.bed_temperature_c = config.reactor_temp_c

    return result
