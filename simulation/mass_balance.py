"""
Mass Balance Module
===================
Validates conservation of mass across the gasification system.

Principle:
  Mass_in = Mass_gas_out + Mass_solid_out + Mass_water_out + Unaccounted
  
  Balance error = |Mass_in - Mass_out| / Mass_in × 100%
  
  Tolerance: < 5% → PASS, 5-10% → WARNING, >10% → FAIL
"""

from dataclasses import dataclass, field


@dataclass
class MassBalanceResult:
    """Mass balance calculation results."""
    input_waste_kg_h: float = 0.0
    input_air_kg_h: float = 0.0
    total_input_kg_h: float = 0.0
    gas_output_kg_h: float = 0.0
    solid_output_kg_h: float = 0.0
    water_output_kg_h: float = 0.0
    total_output_kg_h: float = 0.0
    balance_error_pct: float = 0.0
    status: str = "UNKNOWN"
    valid: bool = True
    details: dict = field(default_factory=dict)


def calculate_mass_balance(
    waste_feed_kg_h: float,
    airflow_m3_h: float,
    gas_output_kg_h: float,
    solid_output_kg_h: float,
    moisture_pct: float = 15.0,
    air_density: float = 1.225,
) -> MassBalanceResult:
    """
    Calculate mass balance around the gasification system.
    
    Inputs:
      - waste_feed_kg_h: Total waste feed rate (kg/h)
      - airflow_m3_h: Air volumetric flow rate (m³/h)  
      - gas_output_kg_h: Product gas mass flow (kg/h)
      - solid_output_kg_h: Char + ash output (kg/h)
      - moisture_pct: Waste moisture content (%)
      - air_density: Air density at inlet conditions (kg/m³)
    
    Mass balance:
      waste_in + air_in = gas_out + solid_out + water_evap + unaccounted
    """
    result = MassBalanceResult()
    
    if waste_feed_kg_h <= 0:
        result.valid = False
        result.status = "INVALID"
        return result
    
    # Inputs
    result.input_waste_kg_h = waste_feed_kg_h
    result.input_air_kg_h = airflow_m3_h * air_density
    result.total_input_kg_h = result.input_waste_kg_h + result.input_air_kg_h
    
    # Outputs
    result.gas_output_kg_h = gas_output_kg_h
    result.solid_output_kg_h = solid_output_kg_h
    # Water vapor in product gas is already counted in gas_output
    # Additional water from moisture that condenses or exits
    result.water_output_kg_h = waste_feed_kg_h * moisture_pct / 100.0 * 0.3  # ~30% exits as liquid
    
    result.total_output_kg_h = (
        result.gas_output_kg_h + 
        result.solid_output_kg_h + 
        result.water_output_kg_h
    )
    
    # Balance error
    if result.total_input_kg_h > 0:
        result.balance_error_pct = abs(
            result.total_input_kg_h - result.total_output_kg_h
        ) / result.total_input_kg_h * 100.0
    
    # Status determination
    if result.balance_error_pct < 5.0:
        result.status = "PASS"
    elif result.balance_error_pct < 10.0:
        result.status = "WARNING"
    else:
        result.status = "FAIL"
    
    result.details = {
        "waste_in": round(result.input_waste_kg_h, 2),
        "air_in": round(result.input_air_kg_h, 2),
        "total_in": round(result.total_input_kg_h, 2),
        "gas_out": round(result.gas_output_kg_h, 2),
        "solid_out": round(result.solid_output_kg_h, 2),
        "water_out": round(result.water_output_kg_h, 2),
        "total_out": round(result.total_output_kg_h, 2),
        "error_pct": round(result.balance_error_pct, 3),
        "status": result.status,
    }
    
    return result
