@echo off
echo Starting HLTV API Server...
echo.
echo Available endpoints:
echo - http://localhost:3000/hltv/basic (fast, basic data)
echo - http://localhost:3000/hltv (with streams, may be slow)
echo - http://localhost:3000/health (health check)
echo.
echo Press Ctrl+C to stop the server
echo.
node hltv.js
pause 