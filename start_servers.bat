@echo off
title Medical Waste-to-Energy Platform
echo =======================================================
echo AI-DRIVEN MEDICAL WASTE-TO-ENERGY SYSTEM
echo =======================================================
echo Starting FastAPI Backend on port 8000...
start "FastAPI Backend" cmd /k "python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"

echo Starting Vite React Frontend on port 5173...
set PATH=C:\Program Files\nodejs;%PATH%
start "Vite Frontend" cmd /k "cd frontend && npm run dev -- --host 127.0.0.1"

echo.
echo All services launched!
echo - Web Dashboard: http://127.0.0.1:5173
echo - API Documentation: http://127.0.0.1:8000/docs
echo.
pause
