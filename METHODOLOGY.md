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
| Column Internal Diameter | $D_R$ | 0.80 | m | **[ASSUMPTION]** Reactor circular geometry |
| Column Cross-Sectional Area | $A_{bed}$ | 0.50265 | m² | $A_{bed} = \frac{\pi}{4} D_R^2$ |
| Static / Slumped Bed Height | $H_{mf}$ | 0.50 | m | **[ASSUMPTION]** Design bed depth |
| Distributor Drop Ratio | $\Delta P_{dist} / \Delta P_{bed}$ | 0.20 | - | **[ASSUMPTION]** Standard design rule (Kunii & Levenspiel) |
| Normal Reference Temperature | $T_{norm}$ | 273.15 (0) | K (°C) | **[ASSUMPTION]** Normal airflow basis ($Nm^3/h$) |
| Normal Reference Pressure | $P_{norm}$ | 101.325 | kPa | **[ASSUMPTION]** Normal airflow basis |
| Softening / Sticking Temperature | $T_{soft}$ | 750.0 | °C | **[ASSUMPTION]** Polymer/ash clumping threshold |
| Approach to WGS Equilibrium | $\alpha_{wgs}$ | 0.80 | - | **[ASSUMPTION]** Finite freeboard residence time |
| Boiler Steam Output Sizing | - | Dynamic | - | **[ASSUMPTION]** Feedwater scales with syngas heat |

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
- *Default Operating Point ($120\text{ Nm}^3/\text{h}$, $850^\circ\text{C}$, $D_R = 0.80\text{ m}$)*:
  $$V_{actual} = 0.13706\text{ m}^3/\text{s} \implies U_0 = 0.2727\text{ m/s}$$

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
$$-\frac{dP}{dz} = (1 - \varepsilon_{mf})(\rho_p - \rho_g) g$$
Equating to the Ergun pressure drop equation:
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
- *Validity Range*: $1.2 \le d_* \le 100$ ($Ar \sim 1.7\text{ to }10^6$). For our bed, $d_* = 6.415$ (well within range).
- *Source*: Haider, A., & Levenspiel, O. (1989), *Powder Technology*, 58, 63-70; Kunii & Levenspiel (1991), p. 81.
- *Default Operating Point*: $U_t = 2.8088\text{ m/s}$.
- *Operating Stability Window Check*:
  $$U_{mf} (0.0564\text{ m/s}) < U_0 (0.2727\text{ m/s}) < U_t (2.8088\text{ m/s}) \implies \text{STABLE FLUIDIZATION}$$
  $$U_0 / U_{mf} = 4.831 \quad (\text{ideal bubbling fluidization ratio})$$

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
4. **Fixed Bed ($U_0 < U_{mf}$)**:
   Evaluated using the Ergun equation integrated across bed height $H_{mf}$ and an orifice-scaling distributor drop.

### 2.9 Bubble Dynamics and Fluidization Regimes
- **Bubble Diameter at Bed Surface**: Darton et al. (1977) coalescence model:
  $$d_b = 0.54 (U_0 - U_{mf})^{0.4} \frac{(H_{mf} + 4 \sqrt{A_0})^{0.8}}{g^{0.2}}$$
  Where $A_0 = 1 / 100\text{ m}^2 = 0.01\text{ m}^2$ (catch area per tuyere orifice, **[ASSUMPTION]**).
- **Bubble Rise Velocity**: Davidson & Harrison (1963):
  $$u_b = (U_0 - U_{mf}) + 0.711 \sqrt{g \cdot d_b}$$
- **Hydrodynamic Regimes**:
  - $U_0 < U_{mf}$: Fixed bed
  - $U_{mf} \le U_0 < 0.75 U_t$: Bubbling bed
  - $0.75 U_t \le U_0 < U_t$: Turbulent fluidization transition
  - $U_0 \ge U_t$: Entrained pneumatic transport
- *Default Operating Point*: $d_b = 0.170\text{ m}$, $u_b = 1.135\text{ m/s}$, Regime: **bubbling**.

### 2.10 Defluidization / Agglomeration Proxy Model
> **Notice**: Plainly documented as a simplified engineering proxy model, *not* first-principles molten polymer sintering kinetics.

When processing clinical plastics at elevated temperatures ($T > T_{soft} = 750^\circ\text{C}$), molten polymer and sticky alkali ash coat the inert sand particles:
$$\Delta T = \max(0.0, T - T_{soft})$$
$$\text{coating factor} = k_{plastic} \cdot w_{plastic} \cdot \left[1 + k_{temp} \left(\frac{\Delta T}{100}\right)\right]$$
$$d_{eff} = d_p \cdot (1 + \text{coating factor})$$
$U_{mf,eff}$ is recalculated via Wen-Yu using $d_{eff}$.
$$\text{Defluidization Margin} = \frac{U_0}{U_{mf,eff}}$$
$$\text{Risk Index} = \text{clamp}\left(\frac{2.0 - \text{Margin}}{2.0 - 1.0}, 0.0, 1.0\right)$$
- If Margin $\ge 2.0$: Risk = 0.0 (safe fluidization).
- If Margin $\le 1.0$: Risk = 1.0 (velocity insufficient to fluidize clumped particles).

---

## 3. Gasifier Thermochemical Physics Corrections

### 3.1 Temperature-Dependent Gas Density
Previously, air density was hardcoded to $1.225\text{ kg/m}^3$ regardless of temperature ($850^\circ\text{C}$). The gasifier now uses:
$$\rho_{air}(T, P) = \frac{P \cdot 1000}{R_{air} \cdot T_K}$$
Actual volumetric flow at bed temperature is converted consistently so mass conservation and buoyancy remain defensible.

### 3.2 Coupling of Feedstock LHV
Previously, gasifier chemical input was hardcoded as $15.0\text{ MJ/kg}$. `calculate_gasification` now receives the computed feedstock LHV from proximate/ultimate analysis (`feedstock_result.lhv_mj_kg`, $18.812\text{ MJ/kg}$ for normal scenario), establishing an unbroken thermochemical energy chain.

### 3.3 Equilibrium-Limited Water-Gas Shift ($K_{wgs}$)
Reaction:
$$\text{CO} + \text{H}_2\text{O} \rightleftharpoons \text{CO}_2 + \text{H}_2$$
Equilibrium constant (Boreskov correlation; Twigg 1989):
$$K_{wgs} = \exp\left(\frac{4577.8}{T_K} - 4.33\right)$$
At $850^\circ\text{C}$ ($1123.15\text{ K}$): $K_{wgs} = 0.7755$.
The equilibrium extent $\xi_{eq}$ is solved analytically from:
$$(n_{\text{CO}_2, 0} + \xi) (n_{\text{H}_2, 0} + \xi) = K_{wgs} (n_{\text{CO}, 0} - \xi) (n_{\text{H}_2\text{O}, 0} - \xi)$$
An approach to equilibrium factor $\alpha_{wgs} = 0.80$ (**[ASSUMPTION]**, reflecting finite residence time) determines the actual shift extent:
$$\xi = \alpha_{wgs} \cdot \xi_{eq}$$

---

## 4. Energy Chain Investigation & Bottleneck Analysis

### 4.1 Stage-by-Stage Energy Flow Printout (Default Scenario)
The default scenario ($500\text{ kg/h}$ waste, $15\%\text{ moisture}$, $20\%\text{ plastic}$, $120\text{ Nm}^3/\text{h air}$, $850^\circ\text{C}$) yields:

1. **Feedstock Chemical Energy Input**: $2612.75\text{ kW}$ (LHV = $18.812\text{ MJ/kg}$)
2. **Syngas Chemical Energy (LHV)**: $1529.91\text{ kW}$ (Cold Gas Efficiency = $58.56\%$)
3. **Heat Recovery Boiler Duty**: $1300.43\text{ kW}$ (Steam flow = $1590.57\text{ kg/h}$ at $10\text{ bar}$, $350^\circ\text{C}$)
4. **Turbine Shaft Power**: $111.22\text{ kW} \implies$ **Electrical Output**: $100.37\text{ kW}$
5. **District Heat Recovery Exchanger**: $17.35\text{ kW}$
6. **Total Useful Energy Output**: $117.72\text{ kW}$

### 4.2 Why Was the Original Overall Efficiency ~1.15%?
In the Phase 1 codebase:
- `water_flow_kg_h` was pinned to $200.0\text{ kg/h}$ in `ScenarioParams`.
- In `steam_cycle.py`:
  $$\dot{m}_{steam} = \min(\text{water\_flow\_kg\_h}, \dot{m}_{steam,max}) = \min(200.0, 1560.5) = 200.0\text{ kg/h}$$
- This artificially limited the boiler heat duty to:
  $$Q_{boiler} = 200.0\text{ kg/h} \times 2943.3\text{ kJ/kg} / 3600 = 163.52\text{ kW}$$
- **The boiler absorbed only $10.69\%$ of the available syngas heat ($1529.91\text{ kW}$)**! Over $89\%$ of syngas chemical heat was discarded.
- Consequently, electrical output was throttled to $12.62\text{ kW}$, resulting in an overall efficiency of:
  $$\eta_{overall} = \frac{12.62\text{ kW} + 17.35\text{ kW}}{2612.75\text{ kW}} = 1.15\%$$

**Resolution**: In `steam_cycle.py`, steam flow is now derived from the available syngas heat duty (`derive_from_heat = True`). The boiler generates $1590.57\text{ kg/h}$ of superheated steam, electrical output rises to $100.37\text{ kW}$, and overall efficiency is $4.51\%$ (Rankine power generation efficiency of $6.56\%$ based on syngas thermal input), which is typical of small-scale industrial biomass/waste gasification plants.

### 4.3 Equivalence Ratio (ER) Analysis
- **Stoichiometric Oxygen Requirement**: $663.85\text{ kg } \text{O}_2/\text{h}$
- **Stoichiometric Air Mass Flow**: $2849.14\text{ kg air/h}$
- **Stoichiometric Air Normal Volume Flow**: $2204.80\text{ Nm}^3/\text{h}$
- **Current Operating Airflow**: $120.0\text{ Nm}^3/\text{h}$
- **Current Equivalence Ratio**:
  $$ER = \frac{\dot{m}_{\text{O}_2, in}}{\dot{m}_{\text{O}_2, stoich}} = 0.0544$$

**Physical Evaluation**:
- The physically reasonable range for autothermal gasification is $0.20 \le ER \le 0.45$.
- **$ER = 0.0544$ is severely air-deficient**. At $ER \approx 0.05$, the system operates in an allothermal pyrolysis / partial smoldering regime, not true autothermal gasification.
- **Airflow corresponding to $ER = 0.30$**:
  $$\dot{m}_{\text{O}_2} = 0.30 \times 663.85 = 199.16\text{ kg/h}$$
  $$\dot{m}_{air} = \frac{199.16}{0.233} = 854.74\text{ kg/h}$$
  $$V_{norm, ER=0.30} = \frac{854.74}{1.2923} = 661.44\text{ Nm}^3/\text{h}$$
  *(Roughly $5.5\times$ higher than the current default parameter).*
- Per specification, scenario input values are preserved unchanged; this finding is documented for operational reference.

---

## 5. Summary Table: Default Operating Point Physics

| Hydrodynamic / Energy Metric | Symbol | Value | Units | Reference / Check |
| :--- | :--- | :--- | :--- | :--- |
| Bed Temperature | $T_{bed}$ | 850.0 | °C | Design parameter |
| Reactor Pressure | $P_{bed}$ | 101.325 | kPa | Atmospheric |
| Gas Density | $\rho_g$ | 0.31427 | kg/m³ | Ideal Gas Law ($\pm 0.1\%$ vs 0.314) |
| Dynamic Viscosity | $\mu_g$ | $4.4487 \times 10^{-5}$ | Pa·s | Sutherland's law ($\pm 0.1\%$ vs 4.45e-5) |
| Archimedes Number | $Ar$ | 264.08 | - | $\pm 0.1\%$ vs 264 |
| Min. Fluidization (Wen-Yu) | $U_{mf,WY}$ | 0.05644 | m/s | Wen & Yu (1966) ($\pm 0.8\%$ vs 0.056) |
| Min. Fluidization (Ergun) | $U_{mf,Ergun}$ | 0.06586 | m/s | Ergun (1952) |
| Umf Correlation Discrepancy | - | 14.30 | % | Within $15\%$ target |
| Superficial Gas Velocity | $U_0$ | 0.2727 | m/s | $V_{actual} / A_{bed}$ |
| Fluidization Velocity Ratio | $U_0 / U_{mf}$ | 4.831 | - | Textbook bubbling bed ($2-10 \times U_{mf}$) |
| Particle Terminal Velocity | $U_t$ | 2.8088 | m/s | Haider & Levenspiel (1989) |
| Geldart Powder Group | - | Group B | - | Geldart (1973) Sand-like |
| Hydrodynamic Regime | - | Bubbling | - | Kunii & Levenspiel (1991) |
| Bed Pressure Drop | $\Delta P_{bed}$ | 7.146 | kPa | Buoyant bed weight per area |
| Distributor Pressure Drop | $\Delta P_{dist}$ | 1.429 | kPa | $20\%$ of bed drop |
| Total Reactor Pressure Drop | $\Delta P_{total}$ | 8.575 | kPa | $\Delta P_{bed} + \Delta P_{dist}$ |
| Bubble Surface Diameter | $d_b$ | 0.170 | m | Darton et al. (1977) |
| Bubble Rise Velocity | $u_b$ | 1.135 | m/s | Davidson & Harrison (1963) |
| Defluidization Risk Index | - | 0.099 | - | Low risk under normal operation |
| Equivalence Ratio | $ER$ | 0.0544 | - | Sub-stoichiometric pyrolysis/gasification |
| Electrical Power Output | $W_e$ | 100.37 | kW | Rankine turbogenerator |
| Overall System Efficiency | $\eta_{overall}$ | 4.51 | % | Heat & Power cogeneration |
