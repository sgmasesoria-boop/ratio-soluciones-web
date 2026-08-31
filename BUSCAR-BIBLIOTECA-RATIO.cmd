@echo off
setlocal
title Biblioteca privada de Ratio
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0platform\operations\start-private-knowledge-search.ps1"
if errorlevel 1 pause

