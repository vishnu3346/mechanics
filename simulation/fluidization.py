"""
Fluidization Hydrodynamics Module
=================================
Rigorous fluid mechanics and hydrodynamics for a gas-solid fluidized bed reactor.
Developed for medical waste-to-energy gasification.

References & Cited Literature:
  - Ergun, S. (1952). "Fluid flow through packed columns", Chem. Eng. Prog., 48, 89-94.
  - Wen, C. Y., & Yu, Y. H. (1966). "Mechanics of fluidization", Chem. Eng. Prog. Symp. Ser., 62, 100-111.
  - Geldart, D. (1973). "Types of gas fluidization", Powder Technology, 7(5), 285-292.
  - Darton, R. C., LaNauze, R. D., Davidson, J. F., & Harrison, D. (1977).
    "Bubble growth due to coalescence in fluidized beds", Trans. Inst. Chem. Eng., 55, 274-280.
  - Davidson, J. F., & Harrison, D. (1963). "Fluidised Particles", Cambridge University Press.
  - Haider, A., & Levenspiel, O. (1989). "Drag coefficient and terminal velocity of normal
    and nonspherical particles", Powder Technology, 58, 63-70.
  - Kunii, D., & Levenspiel, O. (1991). "Fluidization Engineering" (2nd ed.), Butterworth-Heinemann.
  - White, F. M. (2006). "Viscous Fluid Flow" (3rd ed.), McGraw-Hill (Sutherland's law for air).
"""

from dataclasses import dataclass, field
import math
from typing import Dict, List, Tuple, Any, Optional


@dataclass
class FluidizationConfig:
    """
    Design assumptions and hydrodynamic parameters for the fluidized bed reactor.
    All design assumptions are declared here so they are transparent, centrally
    documented, and editable.
    """
    # Particle properties (Silica Sand bed material)
    d_p: float = 400e-6          # ASSUMPTION: Mean bed particle diameter = 400 micrometers (m)
    rho_p: float = 2650.0        # ASSUMPTION: Silica sand particle skeletal density = 2650 kg/m³
    sphericity: float = 0.8      # ASSUMPTION: Particle sphericity phi_s = 0.8 (typical for angular sand)
    eps_mf: float = 0.45         # ASSUMPTION: Bed voidage at minimum fluidization eps_mf = 0.45 (Wen-Yu/Ergun consistent)

    # Reactor geometry
    reactor_diameter: float = 1.30  # ASSUMPTION: Circular column internal diameter = 1.30 m (sized for U0 ~ 0.5-0.7 m/s at ER = 0.30)
    bed_height: float = 0.50        # ASSUMPTION: Static/slumped bed height H_mf = 0.50 m
    distributor_dp_ratio: float = 0.20  # ASSUMPTION: Distributor pressure drop = 20% of bed pressure drop

    # Normal reference conditions for airflow interpretation
    t_ref_k: float = 273.15      # ASSUMPTION: Normal temperature T_norm = 0 °C (273.15 K)
    p_ref_kpa: float = 101.325   # ASSUMPTION: Normal pressure P_norm = 101.325 kPa

    # Sutherland's law constants for air
    # Source: White (2006), Viscous Fluid Flow; Crane TP 410
    mu_ref: float = 1.716e-5     # Reference dynamic viscosity at T_ref = 273.15 K (Pa·s)
    sutherland_t_ref: float = 273.15  # Reference temperature for Sutherland law (K)
    sutherland_s: float = 110.4  # Sutherland temperature constant S for air (K)

    # Physical / gas constants
    r_specific_air: float = 287.058  # Specific gas constant for dry air (J/(kg·K))
    g: float = 9.80665           # Standard acceleration due to gravity (m/s²)

    # Bubble growth parameters (Darton et al., 1977)
    distributor_orifices_per_m2: float = 100.0  # ASSUMPTION: 100 tuyeres/orifices per m² distributor plate

    # Defluidization / agglomeration proxy model parameters
    # Documented: Simplified engineering proxy model, NOT first-principles kinetics
    t_softening_c: float = 750.0  # ASSUMPTION: Polymer/ash softening & sticking onset temperature (°C)
    k_coating_plastic: float = 2.0  # ASSUMPTION: Plastic sensitivity factor for particle coating
    k_coating_temp: float = 0.5     # ASSUMPTION: Thermal excess sensitivity factor per 100 K above softening
    k_agglomeration_diameter: float = 5.0  # ASSUMPTION: Maximum diameter growth scale at agglomeration_index = 1.0 (d_eff = d_p * (1 + k_agg * a))


@dataclass
class FluidizationResult:
    """Comprehensive hydrodynamic results for the fluidized bed reactor."""
    # Gas properties
    rho_g: float = 0.0           # Gas density at bed T and P (kg/m³)
    mu_g: float = 0.0            # Gas dynamic viscosity at bed T (Pa·s)

    # Hydrodynamic velocities
    u0: float = 0.0              # Superficial gas velocity (m/s)
    v_actual_m3_s: float = 0.0   # Actual volumetric gas flow rate (m³/s)
    umf_wen_yu: float = 0.0      # Minimum fluidization velocity from Wen & Yu (1966) (m/s)
    umf_ergun: float = 0.0       # Minimum fluidization velocity from Ergun (1952) (m/s)
    umf_diff_pct: float = 0.0    # Percent difference between Ergun and Wen-Yu Umf (%)
    ut: float = 0.0              # Particle terminal velocity from Haider-Levenspiel (1989) (m/s)
    u0_over_umf: float = 0.0     # Fluidization ratio U0 / Umf (dimensionless)
    is_stable_window: bool = True  # True if Umf < U0 < Ut

    # Dimensionless numbers & classification
    archimedes: float = 0.0      # Archimedes number Ar (dimensionless)
    re_mf_wen_yu: float = 0.0    # Reynolds number at Umf (Wen-Yu)
    re_mf_ergun: float = 0.0     # Reynolds number at Umf (Ergun)
    re_p: float = 0.0            # Particle Reynolds number at U0
    geldart_group: str = "B"     # Geldart (1973) powder classification (A, B, C, or D)

    # Pressure drops
    dp_bed_kpa: float = 0.0      # Fluidized bed pressure drop (buoyant weight per area) (kPa)
    dp_distributor_kpa: float = 0.0  # Distributor plate pressure drop (kPa)
    dp_total_kpa: float = 0.0    # Total reactor pressure drop (bed + distributor) (kPa)
    dp_ratio: float = 1.0        # Ratio of actual fluidized bed drop to expected buoyant plateau (dP_bed / dP_expected)

    # Bubble dynamics
    bubble_diameter_m: float = 0.0  # Equivalent bubble diameter at bed surface (m)
    bubble_velocity_m_s: float = 0.0  # Absolute bubble rise velocity (m/s)
    regime: str = "bubbling"     # Hydrodynamic regime: 'fixed', 'bubbling', 'turbulent', 'entrained'

    # Defluidization / agglomeration model
    agglomeration_index: float = 0.0    # Sintering / agglomeration index [0.0 = clean bed, 1.0 = fully agglomerated]
    d_eff: float = 0.0                  # Effective coated / agglomerated particle diameter (m)
    umf_effective: float = 0.0          # Effective minimum fluidization velocity with d_eff (m/s)
    defluidization_margin: float = 0.0  # Operating margin U0 / Umf_effective
    u0_over_umf_eff: float = 0.0        # Same as defluidization_margin (U0 / Umf_effective)
    u0_over_ut: float = 0.0             # Operating velocity relative to terminal velocity (U0 / Ut)
    defluidization_risk: float = 0.0    # Defluidization risk index [0.0 = safe, 1.0 = defluidized/critical]

    # Physics state classification
    physics_state: str = "NORMAL_FLUIDIZATION"
    physics_risk_level: str = "LOW"
    physics_reason: str = ""

    # Diagnostics
    valid: bool = True
    warnings: List[str] = field(default_factory=list)


def calculate_gas_density(temp_c: float, pressure_kpa: float, config: FluidizationConfig = None) -> float:
    """
    Calculate gas density using the ideal gas law.
    Formula: rho_g = P / (R_specific * T)
    Units: P in Pa, T in K, R in J/(kg·K) -> rho_g in kg/m³
    """
    if config is None:
        config = FluidizationConfig()
    t_k = temp_c + 273.15
    if t_k <= 0.0:
        raise ValueError(f"Temperature must be above absolute zero (-273.15 °C), got {temp_c} °C")
    if pressure_kpa <= 0.0:
        raise ValueError(f"Pressure must be strictly positive, got {pressure_kpa} kPa")
    p_pa = pressure_kpa * 1000.0
    return p_pa / (config.r_specific_air * t_k)


def calculate_gas_viscosity(temp_c: float, config: FluidizationConfig = None) -> float:
    """
    Calculate dynamic viscosity of air using Sutherland's law.
    Reference: White, F. M. (2006), Viscous Fluid Flow, 3rd ed.; Crane TP 410.
    Formula: mu(T) = mu_ref * (T / T_ref)**(3/2) * (T_ref + S) / (T + S)
    Units: T in K, mu in Pa·s
    """
    if config is None:
        config = FluidizationConfig()
    t_k = temp_c + 273.15
    if t_k <= 0.0:
        raise ValueError(f"Temperature must be above absolute zero, got {temp_c} °C")
    t_ref = config.sutherland_t_ref
    s = config.sutherland_s
    mu_ref = config.mu_ref
    return mu_ref * ((t_k / t_ref) ** 1.5) * ((t_ref + s) / (t_k + s))


def calculate_superficial_velocity(
    airflow_m3_h: float,
    temp_c: float,
    pressure_kpa: float,
    config: FluidizationConfig = None
) -> Tuple[float, float]:
    """
    Convert normal airflow (Nm³/h at 0 °C, 101.325 kPa) to actual volumetric flow rate
    at bed temperature and pressure, and compute superficial velocity U0.

    ASSUMPTION: airflow_m3_h is interpreted as normal conditions (0 °C, 101.325 kPa).
    Formula:
      V_actual = V_norm * (T_actual / T_norm) * (P_norm / P_actual)
      U0 = V_actual / A_bed
      A_bed = pi * D_bed² / 4
    Returns:
      (u0_m_s, v_actual_m3_s)
    """
    if config is None:
        config = FluidizationConfig()
    if airflow_m3_h < 0.0:
        raise ValueError(f"Airflow rate cannot be negative, got {airflow_m3_h} m³/h")
    t_k = temp_c + 273.15
    if t_k <= 0.0:
        raise ValueError(f"Temperature must be above absolute zero, got {temp_c} °C")
    if pressure_kpa <= 0.0:
        raise ValueError(f"Pressure must be strictly positive, got {pressure_kpa} kPa")

    # Normal flow in m³/s
    v_norm_m3_s = airflow_m3_h / 3600.0

    # Actual flow via ideal gas expansion
    v_actual_m3_s = v_norm_m3_s * (t_k / config.t_ref_k) * (config.p_ref_kpa / pressure_kpa)

    # Column cross-sectional area
    a_bed = (math.pi / 4.0) * (config.reactor_diameter ** 2)
    u0 = v_actual_m3_s / a_bed if a_bed > 0.0 else 0.0
    return u0, v_actual_m3_s


def calculate_archimedes(
    d_p: float,
    rho_p: float,
    rho_g: float,
    mu_g: float,
    g: float = 9.80665
) -> float:
    """
    Calculate the Archimedes number (Ar).
    Reference: Kunii & Levenspiel (1991), p. 69.
    Formula: Ar = d_p³ * rho_g * (rho_p - rho_g) * g / mu_g²
    Dimensionless measure of the ratio of gravitational buoyancy forces to viscous forces.
    """
    if mu_g <= 0.0:
        raise ValueError("Gas viscosity must be positive")
    delta_rho = rho_p - rho_g
    return (d_p ** 3) * rho_g * delta_rho * g / (mu_g ** 2)


def calculate_umf_ergun(
    d_p: float,
    rho_p: float,
    rho_g: float,
    mu_g: float,
    sphericity: float = 0.8,
    eps_mf: float = 0.45,
    g: float = 9.80665
) -> float:
    """
    Calculate minimum fluidization velocity (Umf) by solving the Ergun equation
    as an exact quadratic at the point where packed bed pressure drop equals
    buoyant bed weight.

    Reference: Ergun, S. (1952), Chem. Eng. Prog., 48, 89-94; Kunii & Levenspiel (1991), p. 68.
    Equation:
      (rho_p - rho_g) * g = 150 * (1 - eps_mf)/(eps_mf³ * (phi_s * d_p)²) * mu_g * Umf
                          + 1.75 * rho_g / (eps_mf³ * phi_s * d_p) * Umf²
    Quadratic form: a * Umf² + b * Umf - c = 0
      a = 1.75 * rho_g / (eps_mf³ * phi_s * d_p)
      b = 150 * (1 - eps_mf) * mu_g / (eps_mf³ * (phi_s * d_p)²)
      c = (rho_p - rho_g) * g
    Solution: Umf = (-b + sqrt(b² + 4 * a * c)) / (2 * a)
    """
    delta_rho = rho_p - rho_g
    if delta_rho <= 0.0:
        return 0.0
    phi_d = sphericity * d_p
    eps3 = eps_mf ** 3

    a = 1.75 * rho_g / (eps3 * phi_d)
    b = 150.0 * (1.0 - eps_mf) * mu_g / (eps3 * (phi_d ** 2))
    c = delta_rho * g

    disc = b * b + 4.0 * a * c
    if disc < 0.0:
        return 0.0
    return (-b + math.sqrt(disc)) / (2.0 * a)


def calculate_umf_wen_yu(
    d_p: float,
    rho_p: float,
    rho_g: float,
    mu_g: float,
    g: float = 9.80665
) -> Tuple[float, float]:
    """
    Calculate minimum fluidization velocity (Umf) using the Wen & Yu (1966) correlation.
    Reference: Wen, C. Y., & Yu, Y. H. (1966), Chem. Eng. Prog. Symp. Ser., 62, 100-111.
    Correlation:
      Re_mf = sqrt(33.7² + 0.0408 * Ar) - 33.7
      Umf = Re_mf * mu_g / (rho_g * d_p)
    Returns:
      (umf_m_s, re_mf)
    """
    ar = calculate_archimedes(d_p, rho_p, rho_g, mu_g, g)
    if ar <= 0.0:
        return 0.0, 0.0
    c1 = 33.7
    c2 = 0.0408
    re_mf = math.sqrt(c1 * c1 + c2 * ar) - c1
    umf = re_mf * mu_g / (rho_g * d_p) if (rho_g * d_p) > 0 else 0.0
    return umf, re_mf


def calculate_terminal_velocity_haider_levenspiel(
    d_p: float,
    rho_p: float,
    rho_g: float,
    mu_g: float,
    sphericity: float = 0.8,
    g: float = 9.80665
) -> float:
    """
    Calculate particle terminal velocity (Ut) using the Haider & Levenspiel (1989)
    correlation for non-spherical particles.

    Reference: Haider, A., & Levenspiel, O. (1989), Powder Technology, 58, 63-70.
    Kunii & Levenspiel (1991), p. 81.

    Dimensionless particle size:
      d* = Ar^(1/3)
    Dimensionless terminal velocity:
      u* = [ 18 / (d*)² + (2.335 - 1.744 * phi_s) / (d*)^0.5 ]^(-1)
    Terminal velocity:
      Ut = u* * [ mu_g * (rho_p - rho_g) * g / rho_g² ]^(1/3)

    Validity: 1.2 <= d* <= 100 (Ar ~ 1.7 to 10⁶), covering intermediate and transition regimes.
    """
    ar = calculate_archimedes(d_p, rho_p, rho_g, mu_g, g)
    if ar <= 0.0:
        return 0.0
    d_star = ar ** (1.0 / 3.0)
    delta_rho = rho_p - rho_g

    # Haider & Levenspiel (1989) correlation for non-spherical particles
    denom = (18.0 / (d_star ** 2)) + ((2.335 - 1.744 * sphericity) / (math.sqrt(d_star)))
    if denom <= 0.0:
        return 0.0
    u_star = 1.0 / denom

    char_velocity = ((mu_g * delta_rho * g) / (rho_g ** 2)) ** (1.0 / 3.0)
    return u_star * char_velocity


def classify_geldart_group(d_p: float, rho_p: float, rho_g: float) -> str:
    """
    Classify particles according to Geldart's powder classification (1973).
    Reference: Geldart, D. (1973), "Types of gas fluidization", Powder Technology, 7, 285-292.
    Boundaries:
      Group C (cohesive): d_p < ~30 µm, highly cohesive, channelling rather than fluidizing.
      Group A (aeratable): small mean size (30 to ~100 µm) or low density; expands before bubbling.
        Criterion: (rho_p - rho_g) * d_p_um < 225,000 (i.e. d_p_um < 225 / ((rho_p - rho_g)/1000)).
      Group B (sand-like): 40-1000 µm, bubbles form immediately at Umf.
      Group D (spoutable): large/dense particles, d_p > 1000 µm (1 mm).
    """
    d_p_um = d_p * 1e6
    delta_rho = rho_p - rho_g
    if delta_rho <= 0.0:
        return "C"

    # Group C: Very fine, cohesive particles
    if d_p_um < 30.0:
        return "C"

    # Group D: Spoutable, large particles (> 1000 µm)
    if d_p_um > 1000.0:
        return "D"

    # Boundary between Group A and Group B
    # Grace (1986); Kunii & Levenspiel (1991), p. 74
    # d_p_ab = 225.0 / (delta_rho / 1000.0) in micrometers
    d_p_ab = 225.0 / (delta_rho / 1000.0)
    if d_p_um < d_p_ab:
        return "A"

    return "B"


def calculate_bed_pressure_drop(
    bed_height: float,
    eps_mf: float,
    rho_p: float,
    rho_g: float,
    distributor_dp_ratio: float = 0.20,
    g: float = 9.80665
) -> Tuple[float, float, float]:
    """
    Calculate bed pressure drop in the fluidized state from buoyant bed weight per unit area,
    and distributor plate pressure drop.

    Reference: Kunii & Levenspiel (1991), p. 65.
    Formulas:
      dP_bed = (1 - eps_mf) * (rho_p - rho_g) * g * H_mf  (Pa)
      dP_distributor = distributor_dp_ratio * dP_bed       (Pa)
      dP_total = dP_bed + dP_distributor                   (Pa)
    Returns:
      (dp_bed_kpa, dp_distributor_kpa, dp_total_kpa)
    """
    delta_rho = rho_p - rho_g
    dp_bed_pa = (1.0 - eps_mf) * delta_rho * g * bed_height
    dp_dist_pa = distributor_dp_ratio * dp_bed_pa
    dp_tot_pa = dp_bed_pa + dp_dist_pa

    return dp_bed_pa / 1000.0, dp_dist_pa / 1000.0, dp_tot_pa / 1000.0


def calculate_fixed_bed_dp_ergun(
    u: float,
    bed_height: float,
    d_p: float,
    eps: float,
    rho_g: float,
    mu_g: float,
    sphericity: float = 0.8
) -> float:
    """
    Calculate fixed-bed pressure drop below Umf using the Ergun (1952) equation.
    Formula:
      dP/L = 150 * (1 - eps)² / (eps³ * (phi_s * d_p)²) * mu_g * u
           + 1.75 * (1 - eps) / (eps³ * phi_s * d_p) * rho_g * u²
    Returns: dP in kPa
    """
    if u <= 0.0:
        return 0.0
    phi_d = sphericity * d_p
    eps3 = eps ** 3
    term_visc = 150.0 * ((1.0 - eps) ** 2) * mu_g * u / (eps3 * (phi_d ** 2))
    term_inert = 1.75 * (1.0 - eps) * rho_g * (u ** 2) / (eps3 * phi_d)
    dp_pa = (term_visc + term_inert) * bed_height
    return dp_pa / 1000.0


def calculate_bubble_properties(
    u0: float,
    umf: float,
    bed_height: float,
    config: FluidizationConfig = None
) -> Tuple[float, float]:
    """
    Calculate bubble equivalent diameter at the bed surface using the Darton et al. (1977)
    coalescence model, and bubble rise velocity using Davidson & Harrison (1963).

    References:
      - Darton, R. C., et al. (1977), Trans. Inst. Chem. Eng., 55, 274-280.
        d_b = 0.54 * (U0 - Umf)^0.4 * (z + 4 * sqrt(A_0))^0.8 / g^0.2
      - Davidson, J. F., & Harrison, D. (1963), Fluidised Particles.
        u_b = (U0 - Umf) + 0.711 * sqrt(g * d_b)
    Returns:
      (bubble_diameter_m, bubble_rise_velocity_m_s)
    """
    if config is None:
        config = FluidizationConfig()
    if u0 <= umf:
        return 0.0, 0.0

    g = config.g
    u_excess = u0 - umf
    # Orifice catch area per tuyere on distributor plate
    n_orifices_per_m2 = max(1.0, config.distributor_orifices_per_m2)
    a_0 = 1.0 / n_orifices_per_m2
    sqrt_a0 = math.sqrt(a_0)

    # Darton correlation evaluated at bed surface z = bed_height
    z = config.bed_height
    d_b = 0.54 * (u_excess ** 0.4) * ((z + 4.0 * sqrt_a0) ** 0.8) / (g ** 0.2)

    # Max bubble diameter physically constrained by column diameter (slugging limit)
    d_b = min(d_b, 0.8 * config.reactor_diameter)

    # Davidson & Harrison (1963) bubble rise velocity
    u_br = 0.711 * math.sqrt(g * d_b)
    u_b = u_excess + u_br

    return d_b, u_b


def determine_fluidization_regime(u0: float, umf: float, ut: float) -> str:
    """
    Determine hydrodynamic regime from superficial velocity ratios.
    Reference: Kunii & Levenspiel (1991), Chapter 3.
      - U0 < Umf: 'fixed' (packed bed)
      - Umf <= U0 < 0.75 * Ut: 'bubbling' (standard bubbling fluidization)
      - 0.75 * Ut <= U0 < Ut: 'turbulent' (turbulent / fast fluidization transition)
      - U0 >= Ut: 'entrained' (pneumatic transport / carryover)
    """
    if u0 < umf:
        return "fixed"
    elif u0 >= ut and ut > 0:
        return "entrained"
    elif ut > 0 and u0 >= 0.75 * ut:
        return "turbulent"
    else:
        return "bubbling"


def classify_physics_state(
    u0: float,
    umf_eff: float,
    ut: float,
    dp_bed: float,
    dp_expected: float,
    temp_c: float,
) -> Tuple[str, str, str]:
    """
    Define state labels purely from physics quantities:
      - U0 / Umf_eff (fluidization margin vs effective agglomerated Umf)
      - U0 / Ut (entrainment / terminal velocity ratio)
      - dP_bed / dP_expected (bed pressure drop plateau ratio vs buoyant bed weight)
      - temp_c margins (relative to polymer softening, tar condensation, and ash fusion)

    Returns:
      (state, risk_level, physical_reason)
    """
    u0_over_umf = u0 / umf_eff if umf_eff > 0 else 0.0
    u0_over_ut = u0 / ut if ut > 0 else 0.0
    dp_ratio = dp_bed / dp_expected if dp_expected > 0 else 1.0

    # 1. SEVERE_CLUMPING / CRITICAL DEFLUIDIZATION:
    if u0_over_umf < 1.0:
        return (
            "SEVERE_CLUMPING",
            "CRITICAL",
            f"Defluidization: superficial velocity U0 ({u0:.3f} m/s) < Umf_eff ({umf_eff:.3f} m/s) (U0/Umf_eff = {u0_over_umf:.3f} < 1.0); agglomerated bed collapsed into fixed state."
        )
    if u0_over_ut >= 0.75:
        return (
            "SEVERE_CLUMPING",
            "CRITICAL",
            f"Terminal blowout: U0/Ut = {u0_over_ut:.3f} >= 0.75; superficial velocity exceeds stable bubbling window causing massive elutriation."
        )
    if dp_ratio < 0.60:
        return (
            "SEVERE_CLUMPING",
            "CRITICAL",
            f"Severe gas channeling: dP_bed/dP_expected = {dp_ratio:.3f} < 0.60; gas channeling through collapsed bed without solids suspension."
        )
    if temp_c < 650.0:
        return (
            "SEVERE_CLUMPING",
            "CRITICAL",
            f"Thermal flameout: bed temperature {temp_c:.1f} °C < 650 °C; insufficient heat for autothermal gasification."
        )
    if temp_c > 1020.0:
        return (
            "SEVERE_CLUMPING",
            "CRITICAL",
            f"Thermal runaway sintering: bed temperature {temp_c:.1f} °C > 1020 °C; severe mineral/ash fusion and bulk clinkering."
        )

    # 2. EARLY_AGGLOMERATION / DEGRADED MARGIN:
    if u0_over_umf < 2.0:
        return (
            "EARLY_AGGLOMERATION",
            "MEDIUM",
            f"Incipient defluidization: U0/Umf_eff = {u0_over_umf:.3f} < 2.0; operating below safe bubbling margin (U0 >= 2 Umf) with growing cluster size."
        )
    if u0_over_ut >= 0.50:
        return (
            "EARLY_AGGLOMERATION",
            "MEDIUM",
            f"High velocity slugging: U0/Ut = {u0_over_ut:.3f} >= 0.50; transition toward turbulent fluidization with elevated fines carryover."
        )
    if dp_ratio < 0.85:
        return (
            "EARLY_AGGLOMERATION",
            "MEDIUM",
            f"Partial gas channeling: dP_bed/dP_expected = {dp_ratio:.3f} < 0.85; localized bed bypassing and stagnant dead zones."
        )
    if temp_c < 750.0:
        return (
            "EARLY_AGGLOMERATION",
            "MEDIUM",
            f"Cold bed margin: bed temperature {temp_c:.1f} °C < 750 °C (softening point); elevated tar condensation risk."
        )
    if temp_c > 930.0:
        return (
            "EARLY_AGGLOMERATION",
            "MEDIUM",
            f"Thermal margin warning: bed temperature {temp_c:.1f} °C > 930 °C; incipient polymer softening and accelerated particle coating."
        )

    # 3. NORMAL_FLUIDIZATION / STABLE OPERATION:
    return (
        "NORMAL_FLUIDIZATION",
        "LOW",
        f"Stable bubbling fluidization: U0/Umf_eff = {u0_over_umf:.3f} >= 2.0, U0/Ut = {u0_over_ut:.3f} < 0.50, dP_bed ratio = {dp_ratio:.3f}, T = {temp_c:.1f} °C."
    )


def calculate_defluidization_model(
    u0: float,
    umf_nominal: float,
    plastic_fraction: float,
    temp_c: float,
    config: FluidizationConfig = None,
    agglomeration_index: Optional[float] = None,
    d_p: Optional[float] = None,
) -> Tuple[float, float, float, float]:
    """
    Bed agglomeration and defluidization model.
    Reuses existing Ergun/Wen-Yu minimum fluidization formulation with effective diameter d_eff.

    Mechanism:
      - If agglomeration_index (a in [0, 1]) is provided:
          d_eff = d_p * (1 + k_agglomeration_diameter * a)
      - If agglomeration_index is None, proxy model based on plastic and temperature is used:
          coating_factor = k_plastic * w_plastic * (1 + k_temp * (max(0, T - T_soft) / 100))
          d_eff = d_p * (1 + coating_factor)
      - Umf_eff is recalculated using Wen-Yu (and Ergun consistent) with d_eff.
      - Defluidization margin = U0 / Umf_eff
      - Defluidization risk in [0, 1]: 0.0 (safe) when margin >= 2.0; 1.0 (critical) when margin <= 1.0.

    Returns:
      (d_eff, umf_effective, defluidization_margin, defluidization_risk)
    """
    if config is None:
        config = FluidizationConfig()

    base_dp = d_p if d_p is not None else config.d_p

    if agglomeration_index is not None:
        a_idx = max(0.0, min(1.0, float(agglomeration_index)))
        growth = config.k_agglomeration_diameter * a_idx
        d_eff = base_dp * (1.0 + growth)
    else:
        w_plastic = max(0.0, min(1.0, plastic_fraction))
        delta_t = max(0.0, temp_c - config.t_softening_c)
        coating_factor = config.k_coating_plastic * w_plastic * (
            1.0 + config.k_coating_temp * (delta_t / 100.0)
        )
        d_eff = base_dp * (1.0 + coating_factor)

    # Recalculate Umf using Wen-Yu with effective diameter
    rho_g = calculate_gas_density(temp_c, config.p_ref_kpa, config)
    mu_g = calculate_gas_viscosity(temp_c, config)
    umf_eff, _ = calculate_umf_wen_yu(d_eff, config.rho_p, rho_g, mu_g, config.g)

    # Margin: how many times Umf_eff the current gas velocity is
    margin = u0 / umf_eff if umf_eff > 0 else 0.0

    # Risk index: safe (0.0) when margin >= 2.0; critical (1.0) when margin <= 1.0
    if margin >= 2.0:
        risk = 0.0
    elif margin <= 1.0:
        risk = 1.0
    else:
        risk = (2.0 - margin) / (2.0 - 1.0)

    risk = max(0.0, min(1.0, risk))
    return d_eff, umf_eff, margin, risk


def calculate_fluidization(
    airflow_m3_h: float = 120.0,
    reactor_temp_c: float = 850.0,
    pressure_kpa: float = 101.325,
    plastic_ratio: float = 0.20,
    config: FluidizationConfig = None,
    agglomeration_index: Optional[float] = None,
    d_p: Optional[float] = None,
) -> FluidizationResult:
    """
    Main calculation entry point for reactor fluidization hydrodynamics.

    Parameters:
      airflow_m3_h: Volumetric airflow at normal conditions (0 °C, 101.325 kPa)
      reactor_temp_c: Fluidized bed operating temperature (°C)
      pressure_kpa: Reactor absolute operating pressure (kPa)
      plastic_ratio: Feedstock plastic mass fraction (0 to 1)
      config: Reactor hydrodynamic design configuration
      agglomeration_index: Optional explicit particle agglomeration index [0.0 to 1.0]
      d_p: Optional base particle diameter override (m)

    Returns:
      FluidizationResult with full hydrodynamic state.
    """
    if config is None:
        config = FluidizationConfig()

    base_dp = d_p if d_p is not None else config.d_p

    res = FluidizationResult()

    # Input validation / clamping with warnings
    if airflow_m3_h < 0.0:
        raise ValueError(f"Airflow cannot be negative: {airflow_m3_h}")
    if reactor_temp_c < -273.15:
        raise ValueError(f"Temperature cannot be below absolute zero: {reactor_temp_c}")
    if pressure_kpa <= 0.0:
        raise ValueError(f"Pressure must be positive: {pressure_kpa}")

    if airflow_m3_h == 0.0:
        res.warnings.append("Zero airflow: reactor is unfluidized (U0 = 0).")

    # 1. Gas properties
    res.rho_g = calculate_gas_density(reactor_temp_c, pressure_kpa, config)
    res.mu_g = calculate_gas_viscosity(reactor_temp_c, config)

    # 2. Superficial velocity
    res.u0, res.v_actual_m3_s = calculate_superficial_velocity(
        airflow_m3_h, reactor_temp_c, pressure_kpa, config
    )

    # 3. Archimedes number
    res.archimedes = calculate_archimedes(
        base_dp, config.rho_p, res.rho_g, res.mu_g, config.g
    )

    # 4. Minimum fluidization velocities (Wen-Yu and Ergun)
    res.umf_wen_yu, res.re_mf_wen_yu = calculate_umf_wen_yu(
        base_dp, config.rho_p, res.rho_g, res.mu_g, config.g
    )
    res.umf_ergun = calculate_umf_ergun(
        base_dp, config.rho_p, res.rho_g, res.mu_g,
        config.sphericity, config.eps_mf, config.g
    )
    # Re_mf Ergun
    res.re_mf_ergun = res.rho_g * res.umf_ergun * base_dp / res.mu_g if res.mu_g > 0 else 0.0

    # Percent difference relative to Ergun Umf
    if res.umf_ergun > 0:
        res.umf_diff_pct = abs(res.umf_ergun - res.umf_wen_yu) / res.umf_ergun * 100.0
    else:
        res.umf_diff_pct = 0.0

    # Particle Reynolds number at operating U0
    res.re_p = res.rho_g * res.u0 * base_dp / res.mu_g if res.mu_g > 0 else 0.0

    # 5. Terminal velocity (Haider & Levenspiel 1989)
    res.ut = calculate_terminal_velocity_haider_levenspiel(
        base_dp, config.rho_p, res.rho_g, res.mu_g, config.sphericity, config.g
    )

    # 6. Stability window & ratio
    umf_ref = res.umf_wen_yu  # Use Wen-Yu as primary reference
    res.u0_over_umf = res.u0 / umf_ref if umf_ref > 0 else 0.0
    res.is_stable_window = (umf_ref < res.u0 < res.ut)

    # 7. Geldart group
    res.geldart_group = classify_geldart_group(base_dp, config.rho_p, res.rho_g)

    # 8. Defluidization / agglomeration model
    (
        res.d_eff,
        res.umf_effective,
        res.defluidization_margin,
        res.defluidization_risk
    ) = calculate_defluidization_model(
        res.u0, umf_ref, plastic_ratio, reactor_temp_c, config,
        agglomeration_index=agglomeration_index, d_p=base_dp
    )
    if agglomeration_index is not None:
        res.agglomeration_index = max(0.0, min(1.0, float(agglomeration_index)))
    else:
        res.agglomeration_index = min(1.0, max(0.0, (res.d_eff / base_dp - 1.0) / config.k_agglomeration_diameter))

    res.u0_over_umf_eff = res.defluidization_margin
    res.u0_over_ut = res.u0 / res.ut if res.ut > 0 else 0.0

    # 9. Pressure drops
    expected_dp_bed_kpa, expected_dist_kpa, _ = calculate_bed_pressure_drop(
        config.bed_height, config.eps_mf, config.rho_p, res.rho_g,
        config.distributor_dp_ratio, config.g
    )
    res.dp_bed_kpa = expected_dp_bed_kpa
    res.dp_distributor_kpa = expected_dist_kpa
    res.dp_total_kpa = res.dp_bed_kpa + res.dp_distributor_kpa

    # If U0 < Umf, bed is unfluidized: pressure drop follows Ergun ramp
    if res.u0 < umf_ref and umf_ref > 0:
        fixed_bed_dp = calculate_fixed_bed_dp_ergun(
            res.u0, config.bed_height, base_dp, config.eps_mf,
            res.rho_g, res.mu_g, config.sphericity
        )
        res.dp_bed_kpa = min(expected_dp_bed_kpa, fixed_bed_dp)
        dist_factor = (res.u0 / umf_ref) ** 2
        res.dp_distributor_kpa = expected_dist_kpa * dist_factor
        res.dp_total_kpa = res.dp_bed_kpa + res.dp_distributor_kpa

    res.dp_ratio = res.dp_bed_kpa / expected_dp_bed_kpa if expected_dp_bed_kpa > 0 else 1.0

    # 10. Bubble properties & regime
    res.bubble_diameter_m, res.bubble_velocity_m_s = calculate_bubble_properties(
        res.u0, umf_ref, config.bed_height, config
    )
    res.regime = determine_fluidization_regime(res.u0, umf_ref, res.ut)

    # 11. Physics state classification
    res.physics_state, res.physics_risk_level, res.physics_reason = classify_physics_state(
        u0=res.u0,
        umf_eff=res.umf_effective,
        ut=res.ut,
        dp_bed=res.dp_bed_kpa,
        dp_expected=expected_dp_bed_kpa,
        temp_c=reactor_temp_c
    )

    return res


def generate_dp_curve(
    reactor_temp_c: float = 850.0,
    pressure_kpa: float = 101.325,
    plastic_ratio: float = 0.20,
    current_airflow_m3_h: float = 120.0,
    n_points: int = 100,
    config: FluidizationConfig = None
) -> Dict[str, Any]:
    """
    Generate full dP vs U0 curve data arrays:
      - Fixed-bed Ergun ramp below Umf
      - Plateau at buoyant bed weight above Umf
      - Entrainment transition marker near Ut
      - Operating point indicator
      - Full assumptions dictionary

    Returns structured dict suitable for API serialization and plotting.
    """
    if config is None:
        config = FluidizationConfig()

    current_state = calculate_fluidization(
        airflow_m3_h=current_airflow_m3_h,
        reactor_temp_c=reactor_temp_c,
        pressure_kpa=pressure_kpa,
        plastic_ratio=plastic_ratio,
        config=config
    )

    umf = current_state.umf_wen_yu
    ut = current_state.ut
    dp_plateau_bed = current_state.dp_bed_kpa
    dp_dist_plateau = current_state.dp_distributor_kpa

    # Velocity range: from 0 up to 1.25 * Ut (or max 4.0 m/s)
    u_max = max(1.25 * ut, 3.5) if ut > 0 else 3.5
    u_points = [i * (u_max / (n_points - 1)) for i in range(n_points)]

    dp_bed_curve = []
    dp_dist_curve = []
    dp_total_curve = []

    for u in u_points:
        if u < umf:
            # Fixed bed Ergun ramp
            dp_b = calculate_fixed_bed_dp_ergun(
                u, config.bed_height, config.d_p, config.eps_mf,
                current_state.rho_g, current_state.mu_g, config.sphericity
            )
            dp_b = min(dp_plateau_bed, dp_b)
            dp_d = dp_dist_plateau * ((u / umf) ** 2) if umf > 0 else 0.0
        elif u <= ut:
            # Fluidized plateau
            dp_b = dp_plateau_bed
            # Distributor drop continues to rise quadratically with gas velocity
            dp_d = dp_dist_plateau * ((u / umf) ** 2) if umf > 0 else dp_dist_plateau
        else:
            # Beyond terminal velocity: pneumatic transport / bed emptying
            # Bed weight begins to decrease exponentially as particles are elutriated
            elutriation_decay = math.exp(-2.5 * (u - ut) / ut) if ut > 0 else 1.0
            dp_b = dp_plateau_bed * elutriation_decay
            dp_d = dp_dist_plateau * ((u / umf) ** 2) if umf > 0 else dp_dist_plateau

        dp_bed_curve.append(round(dp_b, 4))
        dp_dist_curve.append(round(dp_d, 4))
        dp_total_curve.append(round(dp_b + dp_d, 4))

    return {
        "u_curve": [round(u, 4) for u in u_points],
        "dp_bed_curve": dp_bed_curve,
        "dp_distributor_curve": dp_dist_curve,
        "dp_total_curve": dp_total_curve,
        "operating_point": {
            "u0_m_s": round(current_state.u0, 4),
            "dp_bed_kpa": round(current_state.dp_bed_kpa, 3),
            "dp_distributor_kpa": round(current_state.dp_distributor_kpa, 3),
            "dp_total_kpa": round(current_state.dp_total_kpa, 3),
            "u0_over_umf": round(current_state.u0_over_umf, 3),
            "regime": current_state.regime,
        },
        "umf": {
            "wen_yu_m_s": round(current_state.umf_wen_yu, 4),
            "ergun_m_s": round(current_state.umf_ergun, 4),
            "effective_m_s": round(current_state.umf_effective, 4),
            "percent_difference": round(current_state.umf_diff_pct, 2),
        },
        "ut_m_s": round(current_state.ut, 4),
        "archimedes": round(current_state.archimedes, 2),
        "gas_density_kg_m3": round(current_state.rho_g, 4),
        "gas_viscosity_pa_s": round(current_state.mu_g, 6),
        "geldart_group": current_state.geldart_group,
        "defluidization_risk": round(current_state.defluidization_risk, 3),
        "defluidization_margin": round(current_state.defluidization_margin, 3),
        "assumptions": {
            "bed_material": "Silica sand",
            "mean_particle_diameter_m": config.d_p,
            "particle_density_kg_m3": config.rho_p,
            "sphericity": config.sphericity,
            "bed_voidage_at_mf": config.eps_mf,
            "reactor_diameter_m": config.reactor_diameter,
            "static_bed_height_m": config.bed_height,
            "distributor_dp_ratio": config.distributor_dp_ratio,
            "normal_conditions": "0 °C, 101.325 kPa",
            "softening_onset_temp_c": config.t_softening_c,
        }
    }
