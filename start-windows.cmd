@echo off
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 goto python
py -3 -m creator.server --open
goto finish
:python
python -m creator.server --open
:finish
if errorlevel 1 pause
