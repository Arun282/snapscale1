@echo off
set DIR=%~dp0
if "%JAVA_HOME%"=="" set JAVA_HOME=%ProgramFiles%\Java\jdk-17
"%JAVA_HOME%\bin\java.exe" -version >nul 2>&1
if errorlevel 1 (echo Java 17 required & exit /b 1)
gradle %*
