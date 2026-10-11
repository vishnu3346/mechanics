# Fluid Mechanics & Thermochemical Methodology
## Medical Waste-to-Energy Fluidized Bed Gasification Platform

This document details the hydrodynamic, thermodynamic, and thermochemical governing equations, empirical correlations, physical design assumptions, and energy flow investigations implemented in the simulation platform.

---

## 1. Design Assumptions & Reactor Configuration

All hydrodynamic assumptions are encapsulated in `FluidizationConfig` (`simulation/fluidization.py`) so they remain fully editable, inspectable, and reproducible:

| Parameter | Symbol | Value | Units | Source / Reference |
| :--- | :--- | :--- | :--- | :--- |
| Bed Material | - | Silica Sand | - | Standard fluidized bed inert medium |
| Mean Particle Diameter | $d_p$ | $400 \times 10^{-6}$ | m (400 µm) | **[ASSUMPTION]** Course project design baseline |
| Particle Skeletal Density | $\rho_p$ | 2650.0 | kg/m³ | Pure silica sand density (Kunii & Levenspiel 1991) |
| Particle Sphericity | $\phi_s$ | 0.80 | - | **[ASSUMPTION]** Angular silica sand sphericity |
| Bed Voidage at Min. Fluidization | $\varepsilon_{mf}$ | 0.45 | - | **[ASSUMPTION]** Wen-Yu & Ergun consistent value |
| Column Internal Diameter | $D_R$ | 1.30 | m | **[ASSUMPTION]** Sized so $U_0 \approx 0.5 - 0.7\text{ m/s}$ at $ER = 0.30$ |
| Column Cross-Sectional Area | $A_{bed}$ | 1.3273 | m² | $A_{bed} = \frac{\pi}{4} D_R^2$ |
| Static / Slumped Bed Height | $H_{mf}$ | 0.50 | m | **[ASSUMPTION]** Design bed depth |
| Distributor Drop Ratio | $\Delta P_{dist} / \Delta P_{bed}$ | 0.20 | - | **[ASSUMPTION]** Standard design rule (Kunii & Levenspiel) |
| Normal Reference Temperature | $T_{norm}$ | 273.15 (0) | K (°C) | **[ASSUMPTION]** Normal airflow basis ($Nm^3/h$) |
| Normal Reference Pressure | $P_{norm}$ | 101.325 | kPa | **[ASSUMPTION]** Normal airflow basis |
| Softening / Sticking Temperature | $T_{soft}$ | 750.0 | °C | **[ASSUMPTION]** Polymer/ash clumping threshold |
| Approach to WGS Equilibrium | $\alpha_{wgs}$ | 0.85 | - | **[ASSUMPTION]** Finite freeboard residence time |
| Boiler Steam Output Sizing | - | Dynamic | - | **[ASSUMPTION]** Feedwater scales with syngas heat |
| District Heating Water Delivery | $T_{dh,out}$ | 70.0 | °C | **[ASSUMPTION]** District hot water supply temperature |
| Condensate Return State | $T_{cond}$ | 50.0 | °C | **[ASSUMPTION]** Subcooled liquid condensate return |

---

## 2. Fluid Mechanics & Hydrodynamic Formulations

### 2.1 Gas Density (Ideal Gas Law)
At reactor bed temperature $T$ (K) and operating absolute pressure $P$ (Pa):
$$\rho_g = \frac{P}{R_{specific} \cdot T}$$
Where $R_{specific} = 287.058\text{ J/(kg}\cdot\text{K)}$ for dry air.
- *Default Operating Point ($850^\circ\text{C}$, $101.325\text{ kPa}$)*: $\rho_g = 0.31427\text{ kg/m}^3$.

### 2.2 Gas Dynamic Viscosity (Sutherland's Law)
Calculated as a function of absolute temperature $T$ using Sutherland's law for air:
$$\mu_g(T) = \mu_0 \cdot \left(\frac{T}{T_0}\right)^{3/2} \cdot \left(\frac{T_0 + S}{T + S}\right)$$
- Reference viscosity: $\mu_0 = 1.716 \times 10^{-5}\text{ Pa}\cdot\text{s}$ at $T_0 = 273.15\text{ K}$
- Sutherland constant: $S = 110.4\text{ K}$
- *Source*: White, F. M. (2006), *Viscous Fluid Flow* (3rd ed.), McGraw-Hill; Crane TP 410.
- *Default Operating Point ($850^\circ\text{C}$)*: $\mu_g = 4.4487 \times 10^{-5}\text{ Pa}\cdot\text{s}$.

### 2.3 Superficial Gas Velocity ($U_0$)
The input airflow rate $V_{norm}$ ($Nm^3/h$) is expanded from normal conditions ($0^\circ\text{C}$, $101.325\text{ kPa}$) to actual reactor volumetric flow rate $V_{actual}$ ($m^3/s$):
$$V_{actual} = \left(\frac{V_{norm}}{3600}\right) \cdot \left(\frac{T_{bed}}{T_{norm}}\right) \cdot \left(\frac{P_{norm}}{P_{bed}}\right)$$
$$U_0 = \frac{V_{actual}}{A_{bed}}$$
- *Default Operating Point ($659.4\text{ Nm}^3/\text{h}$, $850^\circ\text{C}$, $D_R = 1.30\text{ m}$)*:
  $$V_{actual} = 0.7532\text{ m}^3/\text{s} \implies U_0 = 0.5674\text{ m/s}$$
  *(Target operating window $0.5 - 0.7\text{ m/s}$ achieved).*

### 2.4 Archimedes Number ($Ar$)
Dimensionless ratio of buoyant gravitational forces to viscous drag forces:
$$Ar = \frac{d_p^3 \cdot \rho_g \cdot (\rho_p - \rho_g) \cdot g}{\mu_g^2}$$
- *Default Operating Point*: $Ar = 264.08$.

### 2.5 Minimum Fluidization Velocity ($U_{mf}$)

#### A. Wen and Yu (1966) Correlation
Wen and Yu approximated the Ergun equation across a wide spectrum of particle shapes and void fractions:
$$Re_{mf} = \sqrt{C_1^2 + C_2 \cdot Ar} - C_1 = \sqrt{33.7^2 + 0.0408 \cdot Ar} - 33.7$$
$$U_{mf,Wen-Yu} = \frac{Re_{mf} \cdot \mu_g}{\rho_g \cdot d_p}$$
- *Source*: Wen, C. Y., & Yu, Y. H. (1966), *Mechanics of fluidization*, Chem. Eng. Prog. Symp. Ser., 62, 100-111.
- *Default Operating Point*: $Re_{mf} = 0.15946 \implies U_{mf,Wen-Yu} = 0.05644\text{ m/s}$.

#### B. Ergun (1952) Exact Quadratic Formulation
At minimum fluidization, the fixed-bed pressure gradient equals the buoyant weight per unit volume:
$$(1 - \varepsilon_{mf})(\rho_p - \rho_g) g = 150 \frac{(1 - \varepsilon_{mf})^2}{\varepsilon_{mf}^3 (\phi_s d_p)^2} \mu_g U_{mf} + 1.75 \frac{1 - \varepsilon_{mf}}{\varepsilon_{mf}^3 \phi_s d_p} \rho_g U_{mf}^2$$
Dividing by $(1 - \varepsilon_{mf})$ yields the exact quadratic $a U_{mf}^2 + b U_{mf} - c = 0$:
$$a = \frac{1.75 \rho_g}{\varepsilon_{mf}^3 \phi_s d_p}, \quad b = \frac{150 (1 - \varepsilon_{mf}) \mu_g}{\varepsilon_{mf}^3 (\phi_s d_p)^2}, \quad c = (\rho_p - \rho_g) g$$
$$U_{mf,Ergun} = \frac{-b + \sqrt{b^2 + 4 a c}}{2 a}$$
- *Source*: Ergun, S. (1952), *Fluid flow through packed columns*, Chem. Eng. Prog., 48, 89-94.
- *Default Operating Point*: $U_{mf,Ergun} = 0.06586\text{ m/s}$.
- *Agreement*: $|U_{mf,Ergun} - U_{mf,Wen-Yu}| / U_{mf,Ergun} = 14.30\% < 15.0\%$.

### 2.6 Particle Terminal Velocity ($U_t$) and Operating Stability Window
Calculated using the Haider & Levenspiel (1989) regime-aware drag correlation for non-spherical particles ($\phi_s = 0.80$):
$$d_* = Ar^{1/3}$$
$$u_* = \left[ \frac{18}{d_*^2} + \frac{2.335 - 1.744 \phi_s}{d_*^{0.5}} \right]^{-1}$$
$$U_t = u_* \cdot \left[ \frac{\mu_g (\rho_p - \rho_g) g}{\rho_g^2} \right]^{1/3}$$
- *Validity Range*: $1.2 \le d_* \le 100$ ($Ar \sim 1.7\text{ to }10^6$). For our bed, $d_* = 6.415$.
- *Source*: Haider, A., & Levenspiel, O. (1989), *Powder Technology*, 58, 63-70; Kunii & Levenspiel (1991), p. 81.
- *Default Operating Point*: $U_t = 2.8088\text{ m/s}$.
- *Operating Stability Window Check*:
  $$U_{mf} (0.0564\text{ m/s}) < U_0 (0.5674\text{ m/s}) < U_t (2.8088\text{ m/s}) \implies \text{STABLE FLUIDIZATION}$$
  $$U_0 / U_{mf} = 10.05 \quad (\text{bubbling fluidization regime})$$
  $$U_0 / U_t = 0.2020 \ll 1.0 \quad (\text{zero elutriation risk; neither turbulent nor entrained})$$

### 2.7 Geldart Powder Classification
Boundaries based on Geldart (1973) and Kunii & Levenspiel (1991):
- **Group C (Cohesive)**: $d_p < 30\text{ }\mu\text{m}$.
- **Group A (Aeratable)**: $30\text{ }\mu\text{m} \le d_p < \frac{225}{\Delta\rho / 1000}\text{ }\mu\text{m}$.
- **Group B (Sand-like)**: $\frac{225}{\Delta\rho / 1000}\text{ }\mu\text{m} \le d_p \le 1000\text{ }\mu\text{m}$.
- **Group D (Spoutable)**: $d_p > 1000\text{ }\mu\text{m}$.
- *Result for Silica Sand Bed ($d_p = 400\text{ }\mu\text{m}$, $\Delta\rho = 2649.7\text{ kg/m}^3$, $d_{p,AB} = 84.9\text{ }\mu\text{m}$)*: **Group B**.

### 2.8 Bed and Distributor Pressure Drops
1. **Fluidized State Plateau ($\Delta P_{bed}$)**:
   $$\Delta P_{bed} = (1 - \varepsilon_{mf}) (\rho_p - \rho_g) g H_{mf} = (1 - 0.45) \cdot 2649.686 \cdot 9.80665 \cdot 0.50 = 7.146\text{ kPa}$$
2. **Distributor Plate Drop ($\Delta P_{distributor}$)**:
   $$\Delta P_{distributor} = 0.20 \cdot \Delta P_{bed} = 1.429\text{ kPa}$$
3. **Total Operating Pressure Drop**:
   $$\Delta P_{total} = \Delta P_{bed} + \Delta P_{distributor} = 8.575\text{ kPa}$$

### 2.9 Bubble Dynamics and Fluidization Regimes
- **Bubble Diameter at Bed Surface**: Darton et al. (1977) coalescence model:
  $$d_b = 0.54 (U_0 - U_{mf})^{0.4} \frac{(H_{mf} + 4 \sqrt{A_0})^{0.8}}{g^{0.2}} = 0.231\text{ m}$$
- **Bubble Rise Velocity**: Davidson & Harrison (1963):
  $$u_b = (U_0 - U_{mf}) + 0.711 \sqrt{g \cdot d_b} = 1.579\text{ m/s}$$
- **Hydrodynamic Regime Evaluation**:
  At $U_0 = 0.5674\text{ m/s}$, $U_0/U_{mf} \approx 10.05$ and $U_0/U_t \approx 0.202$. The bed operates solidly within the **bubbling fluidization regime**. It is well below the turbulent transition threshold ($U_c \approx 0.75 U_t \approx 2.1\text{ m/s}$) and far below pneumatic entrainment ($U_t = 2.81\text{ m/s}$).

---

## 3. Mass and Elemental Conservation

### 3.1 Gasifier Mass Closure Formulation
Across the gasifier control volume:
$$\text{Mass}_{in} = \dot{m}_{waste} + \dot{m}_{air} = \dot{m}_{waste} + V_{norm} \cdot \rho_{air,norm}$$
$$\text{Mass}_{out} = \dot{m}_{syngas} + \dot{m}_{char+ash}$$
At bed temperatures ($850^\circ\text{C}$), 100% of feedstock moisture enters the gas phase as superheated steam ($H_2O$ vapor). Elemental mass conservation equations (C, H, O, N) are solved simultaneously:
1. **Carbon Balance**: $n_{\text{CO}} + n_{\text{CO}_2} + n_{\text{CH}_4} = n_{\text{C}, reacted}$, with $c_{unreacted}$ leaving as solid char.
2. **Hydrogen Balance**: $2 n_{\text{H}_2} + 2 n_{\text{H}_2\text{O}} + 4 n_{\text{CH}_4} = 2 n_{\text{H}, fuel} + 2 n_{\text{H}_2\text{O}, moisture}$.
3. **Oxygen Balance**: $n_{\text{CO}} + 2 n_{\text{CO}_2} + n_{\text{H}_2\text{O}} = N_{\text{O}, atoms} = 2 n_{\text{O}_2, air} + 2 n_{\text{O}_2, fuel} + n_{\text{H}_2\text{O}, moisture}$.
4. **Nitrogen Balance**: $2 n_{\text{N}_2} = 2 n_{\text{N}_2, air} + 2 n_{\text{N}, fuel}$.

### 3.2 Default Scenario Mass Balance Verification
- **Total Input**: $500.00\text{ kg/h}$ waste + $852.14\text{ kg/h}$ air = $1352.14\text{ kg/h}$.
- **Total Output**: $1287.35\text{ kg/h}$ syngas + $64.75\text{ kg/h}$ char/ash = $1352.10\text{ kg/h}$.
- **Mass Closure Error**:
  $$\text{Error} = \frac{|1352.14 - 1352.10|}{1352.14} \times 100\% = 0.0030\% \quad (\text{PASS, } \ll 2.0\%)$$

---

## 4. Steam Loop Energy Balance & IAPWS-IF97 Formulation

### 4.1 Independent Steam Loop Formulation with Feed Pump
The Rankine steam loop energy balance is derived from rigorous equation-of-state enthalpies using the **IAPWS-IF97** formulation (`iapws` Python library):
1. **Condensate Return State**:
   Condensate exits the district heating condenser at $T_{cond} = 50.0^\circ\text{C}$ and condenser pressure $P_{cond} = 0.5\text{ bar}$ ($0.05\text{ MPa}$):
   $$h_{cond} = h(T=323.15\text{ K}, P=0.05\text{ MPa}) = 209.37\text{ kJ/kg}, \quad v_{cond} = 0.001012\text{ m}^3/\text{kg}$$
2. **Boiler Feed Pump**:
   The feed pump compresses subcooled condensate from $0.5\text{ bar}$ to boiler pressure $P_{boiler} = 10.0\text{ bar}$ ($1.0\text{ MPa}$):
   $$w_{pump, s} = v_{cond} \cdot (P_{boiler} - P_{cond}) = 0.001012 \cdot 950\text{ kPa} = 0.9614\text{ kJ/kg}$$
   $$w_{pump, act} = \frac{w_{pump, s}}{\eta_{pump}} = \frac{0.9614}{0.80} = 1.2017\text{ kJ/kg}$$
   $$h_{feedwater} = h_{cond} + w_{pump, act} = 209.37 + 1.20 = 210.57\text{ kJ/kg}$$
   Mechanical pump shaft power and electric motor consumption:
   $$W_{pump, shaft} = \frac{\dot{m}_{steam} \cdot w_{pump, act}}{3600}\text{ kW}, \quad W_{pump, elec} = \frac{W_{pump, shaft}}{\eta_{motor}}$$
   *(Default scenario: $\dot{m}_{steam} = 1547.24\text{ kg/h} \implies W_{pump, shaft} = 0.517\text{ kW}, W_{pump, elec} = 0.544\text{ kW}$).*
3. **Boiler Steam Generation**:
   Steam is generated at $T_{steam} = 350.0^\circ\text{C}$ ($623.15\text{ K}$) and $P_{steam} = 10.0\text{ bar}$ ($1.0\text{ MPa}$):
   $$h_{steam} = 3158.16\text{ kJ/kg}, \quad s_{steam} = 7.3028\text{ kJ/(kg}\cdot\text{K)}$$
   $$\dot{Q}_{boiler} = \dot{m}_{steam} \cdot (h_{steam} - h_{feedwater}) = \eta_{boiler} \cdot \dot{Q}_{thermal, gasifier} = 0.85 \cdot 1490.40 = 1266.84\text{ kW}$$
   $$\dot{m}_{steam} = \frac{1266.84}{3158.16 - 210.57} \times 3600 = 1547.24\text{ kg/h}$$
4. **Turbine Expansion**:
   Steam expands from $10.0\text{ bar}, 350.0^\circ\text{C}$ to $0.5\text{ bar}$ condenser pressure with isentropic efficiency $\eta_{turb} = 0.75$:
   - Isentropic exhaust state ($s_{ex, s} = s_{steam} = 7.3028\text{ kJ/(kg}\cdot\text{K)}$): $h_{ex, s} = 2542.36\text{ kJ/kg}$
   - Isentropic enthalpy drop: $\Delta h_{isen} = 3158.16 - 2542.36 = 615.80\text{ kJ/kg}$
   - Actual enthalpy drop: $\Delta h_{act} = 0.75 \times 615.80 = 461.85\text{ kJ/kg}$
   - Actual exhaust enthalpy: $h_{ex, act} = 3158.16 - 461.85 = 2696.31\text{ kJ/kg}$ ($T = 107.07^\circ\text{C}$, superheated vapor)
   - Turbine shaft work: $W_{turb, shaft} = \frac{1547.24}{3600} \cdot 461.85 = 198.50\text{ kW}$
   - Gross electrical power ($\eta_{mech} = 0.95, \eta_{gen} = 0.95$): $W_{turb, elec} = 198.50 \cdot 0.95 \cdot 0.95 = 179.14\text{ kW}$
   - Net electrical power: $W_{net, elec} = W_{turb, elec} - W_{pump, elec} = 179.14 - 0.54 = 178.60\text{ kW}$
5. **Condenser & District Heat Exchanger**:
   - Condenser thermal duty: $\dot{Q}_{condenser} = \frac{1547.24}{3600} \cdot (2696.31 - 209.37) = 1068.86\text{ kW}$
   - Recovered district heat ($\varepsilon_{hx} = 0.85 \times 0.95 = 0.8075$): $\dot{Q}_{district} = 863.11\text{ kW}$ (hot water flow $14,869\text{ kg/h}$ at $70^\circ\text{C}$)
   - Unrecovered condenser heat to cooling sink: $\dot{Q}_{unrecovered} = 205.76\text{ kW}$
6. **Steam Loop Energy Closure Identity**:
   $$\text{Inflow} = \dot{Q}_{boiler} + W_{pump, shaft} = 1266.84 + 0.52 = 1267.36\text{ kW}$$
   $$\text{Outflow} = W_{turb, shaft} + \dot{Q}_{condenser} = 198.50 + 1068.86 = 1267.36\text{ kW}$$
   $$\text{Steam Loop Closure Error} = \frac{|1267.36 - 1267.36|}{1266.84} \times 100\% = 0.0000\% \quad (\text{PASS, } < 0.01\%)$$

### 4.2 Thermodynamic Performance Comparison: Phase 2c vs Phase 2d
Incorporating IAPWS-IF97 and feed pump thermodynamics eliminates the simplified correlation under-prediction of enthalpy drop:

| Metric | Symbol | Phase 2c (Simplified) | Phase 2d (IAPWS-IF97 + Pump) | Absolute Change | Physical Rationale |
| :--- | :--- | :---: | :---: | :---: | :--- |
| Steam Engine | - | `SIMPLIFIED_FALLBACK` | **`IAPWS-IF97`** | Library | International standard steam tables |
| Feedwater Inlet Enthalpy | $h_{fw}$ | 209.00 kJ/kg | **210.57 kJ/kg** | +1.57 kJ/kg | Includes feed pump compression head |
| Superheated Steam Enthalpy | $h_{steam}$ | 3026.90 kJ/kg | **3158.16 kJ/kg** | +131.26 kJ/kg | Accurate superheat $C_p$ at 10 bar |
| Turbine Isentropic Drop | $\Delta h_{isen}$ | 335.63 kJ/kg | **615.80 kJ/kg** | +280.17 kJ/kg | Real isentropic expansion to 0.5 bar |
| Actual Turbine Enthalpy Drop | $\Delta h_{act}$ | 251.72 kJ/kg | **461.85 kJ/kg** | +210.13 kJ/kg | Correct isentropic drop $\times 0.75$ |
| Generated Steam Mass Flow | $\dot{m}_{steam}$ | 1618.52 kg/h | **1547.24 kg/h** | -71.28 kg/h | Higher boiler $\Delta h$ per kg steam |
| Feed Pump Shaft Power | $W_{pump,shaft}$ | 0.00 kW | **0.517 kW** | +0.517 kW | Liquid compression from 0.5 to 10 bar |
| Feed Pump Electric Power | $W_{pump,elec}$ | 0.00 kW | **0.544 kW** | +0.544 kW | Pump motor electrical consumption |
| Turbine Shaft Work | $W_{turb,shaft}$ | 113.17 kW | **198.50 kW** | +85.33 kW | Accurate $\Delta h$ expansion |
| Gross Electrical Power | $W_{turb,elec}$ | 102.13 kW | **179.14 kW** | +77.01 kW | Accurate Rankine turbine yield |
| Net Electrical Output | $W_{net,elec}$ | 102.13 kW | **178.60 kW** | +76.47 kW | Gross electric minus pump electric |
| District Recovered Heat | $\dot{Q}_{district}$ | 931.60 kW | **863.11 kW** | -68.49 kW | Steam flow shifted from heat to shaft |
| Unrecovered Condenser Heat | $\dot{Q}_{unrec}$ | 222.08 kW | **205.76 kW** | -16.32 kW | Reduced total condensation duty |
| Total Useful Power (CHP) | $\dot{Q}_{useful}$ | 1033.73 kW | **1041.71 kW** | +7.98 kW | Higher thermodynamic power yield |
| Overall CHP Plant Efficiency | $\eta_{overall}$ | 39.56% | **39.87%** | +0.31% | Net useful output / fuel LHV input |

---

## 5. Whole-Plant First-Law Energy Closure

### 5.1 System Boundary Energy Conservation Equation
The whole-plant energy balance is defined across the complete facility envelope (feedstock reception to stack, electrical bus, and district heating header):
$$\dot{Q}_{chem, in} \longleftrightarrow W_{net, elec} + \dot{Q}_{district} + \dot{Q}_{unrecovered} + \dot{Q}_{wall} + \dot{Q}_{char, chem} + \dot{Q}_{syngas, stack}$$

Where every term is computed from its own physical model without remainder terms:
1. **Feedstock Chemical Energy**: $\dot{Q}_{chem, in} = \frac{\dot{m}_{waste} \cdot LHV_{feed} \cdot 1000}{3600}\text{ kW}$
2. **Net Electrical Power**: $W_{net, elec} = W_{turb, elec} - W_{pump, elec}\text{ kW}$
3. **District Recovered Heat**: $\dot{Q}_{district} = \varepsilon_{hx} \cdot \dot{Q}_{condenser}\text{ kW}$
4. **Unrecovered Condenser Heat**: $\dot{Q}_{unrecovered} = (1 - \varepsilon_{hx}) \cdot \dot{Q}_{condenser}\text{ kW}$
5. **Reactor Wall Heat Loss**: $\dot{Q}_{wall} = 0.02 \cdot \dot{Q}_{chem, in}\text{ kW}$
6. **Unconverted Char Chemical Energy**: $\dot{Q}_{char, chem} = \frac{\dot{m}_{char, C} \cdot 32.8 \cdot 1000}{3600}\text{ kW}$
7. **Syngas Sensible & Stack Losses**:
   $$\dot{Q}_{syngas, stack} = \dot{Q}_{boiler, flue\_loss} + \dot{Q}_{syngas, sensible\_demand} + \dot{Q}_{electromechanical\_losses}$$
   - Boiler flue gas stack loss: $\dot{Q}_{boiler, flue\_loss} = (1 - \eta_{boiler}) \cdot \dot{Q}_{syngas, chem} = 0.15 \cdot 1490.40 = 223.56\text{ kW}$
   - Syngas sensible & evaporative demand: $\dot{Q}_{moist} + \dot{Q}_{feed} + \dot{Q}_{air} = 85.39 + 161.68 + 213.17 = 460.24\text{ kW}$
   - Electromechanical losses: $(W_{turb, shaft} - W_{turb, elec}) + (W_{pump, elec} - W_{pump, shaft}) = 19.36 + 0.03 = 19.38\text{ kW}$
   - Total syngas sensible & stack losses: $223.56 + 460.24 + 19.38 = 703.18\text{ kW}$

### 5.2 Whole-Plant Energy Conservation Table (Default Scenario)

| Stream / Term | Value (kW) | Fraction of Fuel LHV (%) | Physical Meaning |
| :--- | :---: | :---: | :--- |
| **Fuel Chemical Input ($\dot{Q}_{chem, in}$)** | **2612.75** | **100.00%** | Feedstock lower heating value ($18.812\text{ MJ/kg} \times 500\text{ kg/h}$) |
| Net Electrical Power ($W_{net, elec}$) | 178.60 | 6.84% | Exportable electricity (gross 179.14 kW - pump 0.54 kW) |
| District Heating ($\dot{Q}_{district}$) | 863.11 | 33.03% | Useful hot water heating delivered to district network |
| Unrecovered Condenser Heat ($\dot{Q}_{unrec}$) | 205.76 | 7.88% | Condenser heat rejected to cooling tower/ambient sink |
| Reactor Wall Loss ($\dot{Q}_{wall}$) | 52.26 | 2.00% | Conduction/convection heat loss from gasifier shell |
| Unconverted Char Energy ($\dot{Q}_{char, chem}$) | 514.07 | 19.68% | Chemical energy retained in solid char residue |
| Syngas Sensible & Stack Losses ($\dot{Q}_{syngas, stack}$) | 703.18 | 26.91% | Boiler stack flue loss (223.6 kW) + raw syngas sensible heat (460.2 kW) + gen loss |
| **Total Plant Outputs ($\sum \dot{Q}_{out}$)** | **2516.97** | **96.33%** | Sum of all independent output streams |
| **Whole-Plant Closure Error** | **+95.78 kW** | **3.67%** | **Honest closure report** (matches net autothermal surplus) |

#### Physical Interpretation of the 3.67% (+95.78 kW) Discrepancy:
The $95.78\text{ kW}$ difference between Fuel Chemical Input ($2612.75\text{ kW}$) and Total Outputs ($2516.97\text{ kW}$) is not an artificial error or leak. It is **identical to the net autothermal reaction surplus** ($\dot{Q}_{net} = +95.78\text{ kW}$) calculated by `compute_reactor_heat_balance`.
In an autothermal fluidized bed gasifier operating at $850^\circ\text{C}$, the exothermic partial oxidation reactions release $608.30\text{ kW}$, which exceeds the minimum sensible/wall demand ($512.52\text{ kW}$) by $+95.78\text{ kW}$. In physical reality, this surplus enthalpy is carried out by the product syngas as elevated sensible heat (or higher bed temperature). Because the independent stack loss calculation accounts only for the baseline sensible enthalpy to reach $850^\circ\text{C}$ ($460.24\text{ kW}$), the unabsorbed autothermal surplus manifests honestly as a **3.67% closure error**. None of it is masked by artificial plug terms.

---

## 6. Investigation of Clamps, Kinetics & ER 0.05 First-Law Analysis

### 6.1 Audit of Clamps and Constants
A forensic inspection of `simulation/gasifier.py` revealed two critical constraints:
1. **Cold Gas Efficiency Cap at 95.00% (`gasifier.py:284`)**:
   ```python
   result.gasification_efficiency = min(0.95, result.thermal_energy_kw / chemical_input_kw)
   ```
   - **Classification**: **Hardcoded Cap**.
   - **Origin & Energy Violation**: When `feedstock_lhv_mj_kg` was omitted, the gasifier fell back to a default of $15.0\text{ MJ/kg}$ ($2083.3\text{ kW}$ chemical input). At low ER ($0.05$ and $0.10$), high volatile concentration yielded syngas chemical duties of $2178.3\text{ kW}$ and $2240.7\text{ kW}$, resulting in raw ratios of **104.56%** and **107.55%**. This was an **energy-conservation violation of the equilibrium model** (syngas chemical energy cannot exceed feedstock energy without external heating). The `min(0.95, ...)` was a clamp masking this violation.
   - **Resolution**: Sourced feedstock LHV directly from the proximate/ultimate analysis ($18.812\text{ MJ/kg}$) and implemented physical ER-dependent char gasification kinetics. Raw CGE no longer exceeds 100%, and the artificial 0.95 cap was removed.
2. **Constant Carbon Conversion at 84.75% (`gasifier.py:160-168`)**:
   ```python
   base_conversion = min(0.99, max(0.3, 0.6 + 0.4 * (temp - 600) / 400))
   plastic_boost = config.plastic_ratio * 0.1
   carbon_conversion = min(0.99, base_conversion + plastic_boost)
   moisture_penalty = moisture_frac * 0.15
   carbon_conversion = max(0.1, carbon_conversion - moisture_penalty)
   ```
   - **Classification**: **Model Formulation Independent of ER**.
   - **Origin**: The equation depended solely on bed temperature ($850^\circ\text{C} \implies 0.85$), plastic fraction ($0.20 \implies +0.02$), and moisture ($0.15 \implies -0.0225$), evaluating to exactly $0.8475$ regardless of airflow or ER.
   - **Resolution & [ASSUMPTION] Semi-Empirical Kinetics Formulation**:
     Implemented char gasification and oxidation kinetics as a semi-empirical function of ER:
     $$X_C = X_{C, pot} \cdot \left[ f_{vol} + (1 - f_{vol}) \cdot \left(1 - e^{-ER / ER_{ref}}\right) \right]$$
     This formulation is explicitly designated as an **[ASSUMPTION]** and relies on two empirical parameters:
     1. $f_{vol} = \text{F\_VOLATILE\_PYROLYSIS} = 0.65$: Baseline volatile carbon release fraction during instantaneous devolatilization as $ER \to 0$.
     2. $ER_{ref} = \text{ER\_CHAR\_SCALE} = 0.18$: Characteristic equivalence ratio scale governing heterogeneous char oxidation kinetics.
     At $ER \to 0$, devolatilization alone releases ~65% of potential carbon ($X_C \approx 62.3\%$). As oxygen enters with higher ER, char combustion and $CO_2/H_2O$ gasification drive carbon conversion up to $81.5\%$. This is an engineering model approximation rather than a claim of exact fundamental mechanism or exact literature agreement.

### 6.2 Updated ER Sensitivity Sweep Table
With unclamped CGE and ER kinetics, every metric responds uniquely and monotonically across the ER sweep:

| Target ER | Airflow ($Nm^3/h$) | CO (%) | $H_2$ (%) | $CH_4$ (%) | $CO_2$ (%) | $N_2$ (%) | Syngas LHV ($MJ/Nm^3$) | CGE (%) | Carbon Conv. (%) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **0.05** | 109.9 | 31.87 | 42.67 | 1.47 | 5.21 | 13.34 | 9.152 | 67.31 | 62.26 |
| **0.10** | 219.8 | 28.93 | 35.11 | 1.37 | 5.92 | 22.41 | 7.929 | 67.50 | 67.70 |
| **0.20** | 439.6 | 23.20 | 24.44 | 1.18 | 7.58 | 35.22 | 5.990 | 63.95 | 74.95 |
| **0.30** | 659.4 | 18.06 | 17.06 | 1.03 | 9.26 | 44.17 | 4.488 | 57.04 | 79.12 |
| **0.40** | 879.2 | 13.60 | 11.56 | 0.90 | 10.80 | 50.90 | 3.286 | 48.21 | 81.51 |

### 6.3 First-Law Analysis of Negative Exothermic Heat at ER 0.05
In Section 7.2 below, the exothermic chemical energy released at $ER = 0.05$ is evaluated as **$-12.47\text{ kW}$**:
- **Feed Chemical Input ($\dot{Q}_{chem, in}$)**: $2612.78\text{ kW}$ ($18.812\text{ MJ/kg} \times 500\text{ kg/h}$)
- **Syngas Chemical Energy ($\dot{Q}_{syngas, chem}$)**: $1758.71\text{ kW}$
- **Unconverted Char Chemical Energy ($\dot{Q}_{char, chem}$)**: $866.54\text{ kW}$
- **Sum of Chemical Products**: $1758.71 + 866.54 = 2625.25\text{ kW}$
- **Net Exothermic Energy Released ($\dot{Q}_{released}$)**: $\dot{Q}_{chem, in} - (\dot{Q}_{syngas, chem} + \dot{Q}_{char, chem}) = 2612.78 - 2625.25 = \mathbf{-12.47\text{ kW}}$ (apparent $-0.48\%$ energy creation).

**Thermodynamic Evaluation (First-Law Violation)**:
**Yes**, this is an apparent First-Law violation in an autothermal model without external heating:
1. **Thermodynamic Basis**: Devitrification, drying, and pyrolysis are net endothermic ($\Delta H_{rxn} > 0$). In the absence of external heat input, the first law of thermodynamics dictates that total chemical energy (LHV) in products cannot exceed feedstock LHV.
2. **Model Root Cause**: At extreme sub-stoichiometric air ratios ($ER = 0.05$, $109.9\text{ Nm}^3/\text{h}$ air for $500\text{ kg/h}$ waste), the empirical modified equilibrium correlations slightly over-predict volatile combustible species ($CO = 31.87\%$, $H_2 = 42.67\%$) when combined with the empirical devolatilization carbon conversion ($62.26\%$). This creates an apparent $+12.47\text{ kW}$ ($0.48\%$) excess chemical energy.
3. **Physical Reactor Regime**: Under physical gasification conditions, the gasifier suffers a net thermal deficit of **$-347.32\text{ kW}$** at $ER = 0.05$ (allothermal regime). The bed could never achieve or sustain the $850^\circ\text{C}$ reaction temperature without substantial external heating (e.g. electrical heating or external burner). With external heat, that energy input satisfies the First Law. In autothermal air-blown operation, this operating point is physically impossible.

---

## 7. Reactor Energy Balance & Autothermal Regime Analysis

### 7.1 Governing Reactor Heat Balance Equations
For a fluidized bed operating at bed temperature $T_{bed} = 850^\circ\text{C}$ with feed and air admitted at $T_0 = 20.0^\circ\text{C}$:
1. **Thermal Demand Streams ($\dot{Q}_{demand}$)**:
   - **Moisture Evaporation & Superheating**: $\dot{Q}_{moist} = \dot{m}_{moist} \cdot [h_{steam}(850^\circ\text{C}, 1\text{ atm}) - h_{liq}(20^\circ\text{C})] = 87.58\text{ kW}$
   - **Dry Feed Sensible Heating**: $\dot{Q}_{feed} = \dot{m}_{dry} \cdot C_{p, feed} \cdot (T_{bed} - T_0) = 161.64\text{ kW}$ ($C_p \approx 1.65\text{ kJ/kg}\cdot\text{K}$)
   - **Air Sensible Heating**: $\dot{Q}_{air} = \dot{m}_{air} \cdot C_{p, air} \cdot (T_{bed} - T_0) = 1.085 \cdot \dot{m}_{air} \cdot 830 / 3600\text{ kW}$
   - **Reactor Wall Heat Loss**: $\dot{Q}_{wall} = 0.02 \cdot \dot{Q}_{chem, in} = 52.26\text{ kW}$ (**[ASSUMPTION]** 2% of fuel LHV)
2. **Exothermic Chemical Energy Released ($\dot{Q}_{released}$)**:
   By First-Law / Hess's Law across the gasifier:
   $$\dot{Q}_{released} = \dot{Q}_{chem, in} - \dot{Q}_{syngas, chem} - \dot{Q}_{char, chem}$$
   Where $\dot{Q}_{char, chem} = \dot{m}_{char, C} \cdot 32.8\text{ MJ/kg}$ represents unreacted carbon leaving in bed residue.
3. **Net Heat Balance ($\dot{Q}_{net}$)**:
   $$\dot{Q}_{net} = \dot{Q}_{released} - \dot{Q}_{demand}$$
   - **Autothermal Regime ($\dot{Q}_{net} \ge 0$)**: Exothermic oxidation releases sufficient thermal energy to sustain the $850^\circ\text{C}$ bed without external heating.
   - **Allothermal Regime ($\dot{Q}_{net} < 0$)**: The bed suffers a net heat deficit; external supplemental heat or electrical preheating is required to maintain bed temperature.

### 7.2 Reactor Heat Balance Table across ER Sweep

| ER | Airflow ($Nm^3/h$) | Total Demand (kW) | Exothermic Release (kW) | Net Heat Balance (kW) | Thermal Regime | Operational Meaning |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **0.05** | 109.9 | 334.85 | -12.47 | **-347.32** | **ALLOTHERMAL** | Severe deficit; endothermic pyrolysis dominates |
| **0.10** | 219.8 | 370.38 | 96.39 | **-273.99** | **ALLOTHERMAL** | Large deficit; requires external heating |
| **0.20** | 439.6 | 441.44 | 340.82 | **-100.61** | **ALLOTHERMAL** | Moderate deficit; near autothermal transition |
| **0.30** | 659.4 | 512.49 | 608.30 | **+95.81** | **AUTOTHERMAL** | Self-sustaining; stable autothermal operation |
| **0.40** | 879.2 | 583.55 | 889.28 | **+305.74** | **AUTOTHERMAL** | Substantial surplus; combustion heat exceeds demand |

- **Default Scenario Operating Point ($ER = 0.2991$, $659.4\text{ Nm}^3/\text{h}$)**:
  - Total Demand: $512.52\text{ kW}$
  - Exothermic Release: $608.30\text{ kW}$
  - Net Heat Balance: **$+95.78\text{ kW}$ (AUTOTHERMAL SURPLUS)**
  - Transition point from allothermal to autothermal occurs at **$ER \approx 0.245$**, consistent with typical literature ranges for bubbling fluidized beds ($ER \approx 0.20 - 0.25$, Basu 2006; Higman & van der Burgt 2008).

---

## 8. Sized & Re-based Scenario Airflow Table

The default column internal diameter was resized from $0.80\text{ m}$ to **$1.30\text{ m}$** so that superficial velocity is $U_0 \approx 0.5 - 0.7\text{ m/s}$ at $ER = 0.30$. All operational scenarios are re-based relative to this baseline:

| Scenario ID | Name | Old Airflow ($Nm^3/h$) | New Airflow ($Nm^3/h$) | Operating ER | Regime | Fluidization Risk | $U_0 / U_{mf,eff}$ |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `normal` | Normal Operation | 120.0 | **659.4** | 0.2991 | Bubbling | 0.000 (Low) | **10.054** |
| `high_plastic` | High Plastic Waste | 125.0 | **686.9** | 0.3009 | Bubbling | 0.090 (Low) | **10.621** |
| `high_moisture` | High Moisture Waste | 130.0 | **714.4** | 0.4237 | Bubbling | 0.000 (Low) | **10.739** |
| `early_agglomeration` | Early Agglomeration | 115.0 | **631.9** | 0.2866 | Bubbling | 0.000 (Low) | **1.869** |
| `severe_clumping` | Severe Clumping | 95.0 | **522.0** | 0.2454 | Bubbling | 0.247 (Low) | **0.621** |
| `high_throughput` | High Throughput ($800\text{ kg/h}$) | 180.0 | **1055.0** | 0.2991 | Bubbling | 0.000 (Low) | **16.542** |
| `low_airflow` | Low Airflow | 80.0 | **439.6** | 0.1994 | Bubbling | 0.000 (Low) | **6.236** |
| `defluidized_agglomeration` | Defluidized Bed Agglomeration | - | **661.0** | 0.2991 | Fixed/Slumped | 1.000 (Critical) | **0.462** |

---

## 9. Known Limitations & Modeling Assumptions Disclosure

To maintain full transparency, scientific rigor, and engineering integrity, the key assumptions and inherent model constraints are documented plainly:

1. **Boiler Thermal Efficiency Assumption ($\eta_{boiler} = 85.0\%$)**:
   - The boiler heat capture efficiency is modeled as a fixed engineering assumption ($\eta_{boiler} = 0.85$). In physical heat recovery steam generators (HRSG), actual efficiency varies dynamically with fouling factor, excess air ratio, acid gas dew point limits, and convective pass sootblowing cycles.
2. **District Heat Exchanger Effectiveness Assumption ($\varepsilon_{hx} = 0.8075$)**:
   - The overall thermal recovery effectiveness is taken as $\varepsilon_{hx} = 0.85 \times 0.95 = 0.8075$ (combining plate heat exchanger effectiveness $\varepsilon=0.85$ and district distribution piping thermal efficiency $0.95$). Actual network return temperatures and ambient seasonal heat demands will alter heat recovery.
3. **Semi-Empirical Carbon Conversion Kinetics Formula**:
   - The carbon conversion relationship $X_C = X_{C, pot} \cdot [f_{vol} + (1 - f_{vol})(1 - e^{-ER / ER_{ref}})]$ is a semi-empirical engineering formulation rather than a detailed multi-phase particle kinetics solver. It approximates the transition from rapid devolatilization ($f_{vol} = 0.65$) to heterogeneous char oxidation ($ER_{ref} = 0.18$), but does not capture intra-particle pore diffusion or ash layer mass-transfer resistance.
4. **Whole-Plant 3.67% Energy Balance Residual**:
   - The $3.67\%$ ($+95.78\text{ kW}$) energy balance discrepancy in the default scenario is **identical to the net autothermal reaction heat surplus by construction** ($\dot{Q}_{net} = +95.78\text{ kW}$ from `compute_reactor_heat_balance`). It is **not** an independent error measure or leak term. Because the stack loss model assumes baseline sensible enthalpy required to reach $850^\circ\text{C}$ while the partial oxidation chemistry yields an exothermic surplus, this surplus manifests directly as the First-Law residual.

---

## 10. Phase 3: Physics-Labeled Anomaly Detection & Hydrodynamic Agglomeration

### 10.1 Defluidization Physics & Agglomeration Model
In fluidized bed gasification of polymer-rich waste, bed sand grains sinter and coalesce due to molten ash/polymer coatings, forming larger clusters.
1. **Agglomeration Growth Formulation**:
   $$d_{p,eff} = d_p \cdot (1 + k_{agg} \cdot a)$$
   - Base mean silica sand diameter: $d_p = 400\,\mu\text{m}$ ($400 \times 10^{-6}\text{ m}$)
   - Dimensionless agglomeration index: $a \in [0.0, 1.0]$
   - Maximum agglomeration cluster growth factor: $k_{agg} = 5.0$ (at $a = 1.0$, clusters reach $6 \times d_p = 2400\,\mu\text{m}$)
2. **Effective Minimum Fluidization Velocity ($U_{mf,eff}$)**:
   $U_{mf,eff}$ is recalculated directly using the rigorous Ergun (1952) and Wen & Yu (1966) hydrodynamic correlations with $d_{p,eff}$:
   $$Ar_{eff} = \frac{d_{p,eff}^3 \rho_g (\rho_p - \rho_g) g}{\mu_g^2}$$
   $$Re_{mf,eff} = \sqrt{33.7^2 + 0.0408 Ar_{eff}} - 33.7$$
   $$U_{mf,eff} = \frac{Re_{mf,eff} \mu_g}{\rho_g d_{p,eff}}$$
   Because $Ar \propto d_{p,eff}^3$ and $U_{mf} \propto d_{p,eff}^{1.0 \text{ to } 2.0}$, growing agglomerate size drastically raises the gas velocity required to sustain fluidization.
3. **Defluidized Bed Agglomeration Scenario (`defluidized_agglomeration`)**:
   To isolate this physical mechanism, a dedicated scenario was added where $U_0 / U_{mf,eff} < 1.0$ arises **solely** from agglomeration growth:
   - Feed Rate: $500.0\text{ kg/h}$ (identical to baseline `normal`)
   - Feed Moisture: $15.0\%$ (identical to baseline `normal`)
   - Plastic Fraction: $0.20$ (identical to baseline `normal`)
   - Operating Temperature: $850.0^\circ\text{C}$ (identical to baseline `normal`)
   - Airflow: $661.0\text{ Nm}^3/\text{h}$ (identical to baseline `normal`)
   - Operating Pressure: $101.325\text{ kPa}$ (identical to baseline `normal`)
   - **Agglomeration Index**: $a = 0.85$
   - **Physical Consequence**:
     $$d_{p,eff} = 400 \times (1 + 5.0 \times 0.85) = 2100\,\mu\text{m} = 2.10\text{ mm}$$
     $$U_0 = 0.5674\text{ m/s}, \quad U_{mf,eff} = 1.2276\text{ m/s}$$
     $$\frac{U_0}{U_{mf,eff}} = \frac{0.5674}{1.2276} = \mathbf{0.4622} < 1.0 \implies \textbf{COMPLETE DEFLUIDIZATION}$$
   Because airflow and temperature are nominal, defluidization is proven to arise purely from particle agglomeration growth.

### 10.2 State Labels Purely from Physics Quantities
No ground-truth label is permitted to originate from machine learning predictions or predefined scenario names. All state labels are computed strictly from dimensionless fluid mechanics and thermal margins:

| Target Physics State | Physical Quantities / Threshold Criteria | Physical Rationale |
| :--- | :--- | :--- |
| **`SEVERE_CLUMPING`** | 1. $U_0 / U_{mf,eff} < 1.0$<br>2. $U_0 / Ut \ge 0.75$<br>3. $\Delta P_{bed} / \Delta P_{expected} < 0.60$<br>4. $T_{bed} < 650.0^\circ\text{C}$<br>5. $T_{bed} > 1020.0^\circ\text{C}$ | - Superficial velocity below $U_{mf,eff}$ causes complete bed collapse into a packed/slumped bed.<br>- $U_0 / U_t \ge 0.75$ approaches terminal carryover, causing total solids blowout and bed emptying.<br>- $\Delta P$ below 60% of buoyant weight indicates severe gas channeling and stagnant dead zones.<br>- $T < 650^\circ\text{C}$ causes flameout and thermal collapse.<br>- $T > 1020^\circ\text{C}$ triggers massive mineral/ash eutectics and bulk clinkering. |
| **`EARLY_AGGLOMERATION`** | 1. $1.0 \le U_0 / U_{mf,eff} < 2.0$<br>2. $0.50 \le U_0 / Ut < 0.75$<br>3. $0.60 \le \Delta P_{bed} / \Delta P_{expected} < 0.85$<br>4. $650.0^\circ\text{C} \le T_{bed} < 750.0^\circ\text{C}$<br>5. $930.0^\circ\text{C} < T_{bed} \le 1020.0^\circ\text{C}$ | - Standard design rules require $U_0 \ge 2 - 3 U_{mf}$ for stable bubbling; margins $< 2.0$ indicate degraded solids mixing and growing particle clusters.<br>- $0.50 \le U_0 / U_t < 0.75$ marks slugging transition and elevated fines carryover.<br>- $\Delta P$ between 60-85% of buoyant plateau signals localized chimney formation.<br>- $T < 750^\circ\text{C}$ causes heavy tar deposition and sticky particle agglomeration.<br>- $T > 930^\circ\text{C}$ triggers thermal softening of synthetic polymer feedstocks. |
| **`NORMAL_FLUIDIZATION`** | 1. $U_0 / U_{mf,eff} \ge 2.0$<br>2. $U_0 / Ut < 0.50$<br>3. $0.85 \le \Delta P_{bed} / \Delta P_{expected} \le 1.15$<br>4. $750.0^\circ\text{C} \le T_{bed} \le 930.0^\circ\text{C}$ | - Solid bubbling fluidization operating securely within the Kunii-Levenspiel stability window.<br>- Zero elutriation blowout risk.<br>- Stable bed pressure drop plateau matching buoyant bed weight.<br>- Optimal autothermal gasification temperature window. |

### 10.3 Synthetic Telemetry Generator & Measurement Noise
The data generator (`ml/anomaly/generate_data.py`) samples physical operating conditions with a fixed seed (`seed = 42`) across 400 operating condition clusters, executing the full simulator.
- **Documented Sensor Noise**:
  - Thermocouple Bed Temperature: $\mathcal{N}(0, 3.0^\circ\text{C})$
  - Primary Airflow Transmitter: $\mathcal{N}(0, 1.5\text{ Nm}^3/\text{h})$
  - Differential Pressure Transducer: $\mathcal{N}(0, 0.15\text{ kPa})$
  - Compositional Plastic Ratio Sensor: $\mathcal{N}(0, 1.0\%)$
- **Class Proportions (3,200 Total Samples)**:
  - `SEVERE_CLUMPING`: **1,176 samples (36.75%)**
  - `EARLY_AGGLOMERATION`: **1,144 samples (35.75%)**
  - `NORMAL_FLUIDIZATION`: **880 samples (27.50%)**
  - *No class has fewer than 5% of samples (minimum class is 27.50% $\gg$ 5.0%).*

### 10.4 Leakage Check & Observability Analysis
To rigorously verify model integrity, training was performed using a `GroupShuffleSplit` (grouped by operating condition cluster `group_id`) so test samples represent completely unseen operating conditions:

| Evaluation Metric | Model A: With Label-Defining Features | Model B: Plant Telemetry Only (Production) | Absolute Change |
| :--- | :---: | :---: | :---: |
| **Feature Set** | 10 features (includes $U_0/U_{mf,eff}$, $U_0/U_t$, $\Delta P$ ratio) | 7 features (surface plant sensors: $T$, $V_{air}$, $\Delta P$, $w_{plastic}$) | -3 physics ratios |
| **Test Accuracy** | **98.44%** | **45.94%** | **-52.50% drop** |
| **Top Feature 1** | $U_0 / U_{mf,eff}$ (**63.15%**) | Temperature Gradient (**23.12%**) | Shift to raw sensor |
| **Top Feature 2** | Bed Temperature (**11.58%**) | Bed Temperature (**22.33%**) | Thermal indicators |
| **Top Feature 3** | Temperature Gradient (**11.08%**) | Plastic Ratio (**16.98%**) | Feedstock fraction |
| **Top Feature 4** | $U_0 / U_t$ (**5.97%**) | Airflow (**15.93%**) | Gas supply |

#### Plain Leakage Statement:
> **LEAKAGE CHECK FINDING**: Accuracy is near 100% (98.44%) in Model A **ONLY because the label rule directly utilizes the exact same dimensionless physics quantities ($U_0/U_{mf,eff}$) as input features**. The decision trees simply reconstruct the threshold split $U_0/U_{mf,eff} < 1.0$ with 63.15% feature importance.
> When evaluated on unseen operating groups using observable plant telemetry alone (Model B), accuracy drops by **52.50%** down to **45.94%**. This drop occurs because microscopic particle sintering and agglomerate cluster size ($d_{p,eff}$) are **latent internal bed physical states** that cannot be uniquely reconstructed from surface macroscopic telemetry alone without direct in-bed cluster measurement.

#### Production Model B Confusion Matrix & Per-Class Metrics:
- **Confusion Matrix** (Rows = Ground Truth Physics, Columns = Predicted):
  - `EARLY_AGGLOMERATION`: `[114, 52, 82]` (Precision: 0.564, Recall: 0.460, F1: 0.507)
  - `NORMAL_FLUIDIZATION`: `[30, 72, 34]` (Precision: 0.336, Recall: 0.529, F1: 0.411)
  - `SEVERE_CLUMPING`: `[58, 90, 108]` (Precision: 0.482, Recall: 0.422, F1: 0.450)

---

## 11. Scenario Physics vs Machine Learning Comparison Table

Every default and stress scenario was evaluated with both the First-Principles Physics classifier and the retrained Machine Learning model (Random Forest on plant telemetry):

| Scenario ID | Physics Label | ML Prediction | ML Conf. | Status | Physical Reason & Explanation of Disagreement |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `normal` | `NORMAL_FLUIDIZATION` | `NORMAL_FLUIDIZATION` | 53.3% | **MATCH** | All parameters operate at design baseline ($850^\circ\text{C}$, $659.4\text{ Nm}^3/\text{h}$, $U_0/U_{mf,eff} = 10.05 \gg 2.0$). |
| `high_plastic` | `NORMAL_FLUIDIZATION` | `NORMAL_FLUIDIZATION` | 58.3% | **MATCH** | Plastic is elevated ($45\%$), but airflow is proportionally increased ($686.9\text{ Nm}^3/\text{h}$), maintaining $U_0/U_{mf,eff} = 10.62$ in stable bubbling. |
| `high_moisture` | `NORMAL_FLUIDIZATION` | `EARLY_AGGLOMERATION` | 43.8% | **FLAG: DISAGREEMENT** | **Physical Reason**: High moisture ($35\%$) requires higher stoichiometric air ($714.4\text{ Nm}^3/\text{h}$, $+8.3\%$ airflow deviation) and slightly depresses bed temperature ($840^\circ\text{C}$). The ML telemetry model observes the deviation and flags early degradation, but true fluidization physics confirms that the high volumetric gas flow expands velocity ($U_0 = 0.609\text{ m/s}$), keeping $U_0/U_{mf,eff} = 10.74 \gg 2.0$ solidly within the stable bubbling window. |
| `early_agglomeration` | `EARLY_AGGLOMERATION` | `NORMAL_FLUIDIZATION` | 50.0% | **FLAG: DISAGREEMENT** | **Physical Reason**: Telemetry sensors ($820^\circ\text{C}$, $631.9\text{ Nm}^3/\text{h}$) appear close to nominal. However, internal particle agglomeration ($a = 0.25$) has enlarged $d_{p,eff}$ to $900\,\mu\text{m}$, raising $U_{mf,eff}$ to $0.283\text{ m/s}$ and degrading operating margin to $U_0/U_{mf,eff} = 1.869 < 2.0$. Because the ML model only observes surface sensors, it underpredicts the latent agglomeration onset. |
| `severe_clumping` | `SEVERE_CLUMPING` | `EARLY_AGGLOMERATION` | 56.7% | **FLAG: DISAGREEMENT** | **Physical Reason**: Operating at $750^\circ\text{C}$ with $50\%$ plastic and reduced airflow ($522.0\text{ Nm}^3/\text{h}$). Agglomeration ($a = 0.50$) has grown $d_{p,eff}$ to $1400\,\mu\text{m}$, lifting $U_{mf,eff}$ to $0.659\text{ m/s} > U_0 (0.409\text{ m/s})$ and causing complete defluidization ($U_0/U_{mf,eff} = 0.621 < 1.0$). The ML model correctly recognizes an anomaly, but classifies it as `EARLY_AGGLOMERATION` rather than `SEVERE_CLUMPING` because surface telemetry alone cannot distinguish between incipient clumping and complete bed slump. |
| `high_throughput` | `NORMAL_FLUIDIZATION` | `NORMAL_FLUIDIZATION` | 62.7% | **MATCH** | Airflow scales proportionally with $800\text{ kg/h}$ feed ($1055.0\text{ Nm}^3/\text{h}$), yielding vigorous fluidization ($U_0/U_{mf,eff} = 16.54$). |
| `low_airflow` | `NORMAL_FLUIDIZATION` | `NORMAL_FLUIDIZATION` | 44.6% | **MATCH** | Lower air ($439.6\text{ Nm}^3/\text{h}$) reduces superficial velocity to $U_0 = 0.361\text{ m/s}$, but clean particle diameter keeps $U_0/U_{mf,eff} = 6.24 > 2.0$. |
| `defluidized_agglomeration` | `SEVERE_CLUMPING` | `NORMAL_FLUIDIZATION` | 53.3% | **FLAG: DISAGREEMENT** | **Physical Reason**: In this scenario, all macroscopic plant inputs ($850^\circ\text{C}$, $661.0\text{ Nm}^3/\text{h}$, $500\text{ kg/h}$) match nominal design baselines. Defluidization arises **exclusively** from internal particle sintering ($a = 0.85$, $d_{p,eff} = 2.1\text{ mm}$, $U_{mf,eff} = 1.23\text{ m/s} > U_0 = 0.57\text{ m/s} \implies U_0/U_{mf,eff} = 0.462 < 1.0$). Because surface sensor telemetry is indistinguishable from nominal operation, any telemetry-only ML model predicts `NORMAL_FLUIDIZATION`. This proves why First-Principles hydrodynamic modeling is essential alongside machine learning. |

