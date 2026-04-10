; MiMo Bot NSIS Installer Custom Script
; 自定义安装步骤

!macro customInstall
  ; 创建数据目录
  CreateDirectory "$APPDATA\MiMo Bot"
  CreateDirectory "$APPDATA\MiMo Bot\workspace"
  CreateDirectory "$APPDATA\MiMo Bot\workspace\conversations"
  CreateDirectory "$APPDATA\MiMo Bot\workspace\projects"
  CreateDirectory "$APPDATA\MiMo Bot\workspace\flows"
  CreateDirectory "$APPDATA\MiMo Bot\plugins"
!macroend

!macro customUnInstall
  ; 询问是否保留用户数据
  MessageBox MB_YESNO "是否保留用户数据（流程、对话记录、设置）？" IDYES skip
    RMDir /r "$APPDATA\MiMo Bot"
  skip:
!macroend
