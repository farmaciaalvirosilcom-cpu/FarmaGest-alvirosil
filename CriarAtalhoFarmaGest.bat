@echo off
REM ===================================================================
REM Cria um atalho "FarmaGest" na Area de Trabalho, com icone
REM profissional, abrindo o sistema em modo "app" no Microsoft Edge
REM (sem barra de endereco, sem abas).
REM
REM IMPORTANTE: este arquivo deve estar na MESMA PASTA que o
REM index.html e o FarmaGest.ico do sistema. Nao mova um sem o outro.
REM ===================================================================

set PASTA=%~dp0
set ARQUIVO=%PASTA%index.html
set ICONE=%PASTA%FarmaGest.ico
set ATALHO=%USERPROFILE%\Desktop\FarmaGest.lnk

powershell -NoProfile -Command ^
  "$s = (New-Object -COM WScript.Shell).CreateShortcut('%ATALHO%');" ^
  "$s.TargetPath = 'msedge';" ^
  "$s.Arguments = '--app=\"file:///%ARQUIVO%\"';" ^
  "$s.IconLocation = '%ICONE%';" ^
  "$s.WorkingDirectory = '%PASTA%';" ^
  "$s.Description = 'FarmaGest - Farmacia Alvirosil';" ^
  "$s.Save()"

echo.
echo Atalho "FarmaGest" criado na Area de Trabalho com sucesso!
pause
