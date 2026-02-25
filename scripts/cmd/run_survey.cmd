@echo off
setlocal

set ROOT=%~dp0..\..
for %%I in ("%ROOT%") do set ROOT=%%~fI
pushd %ROOT%\frontend\survey

if not exist node_modules (
  npm install
)

npm run dev

popd
