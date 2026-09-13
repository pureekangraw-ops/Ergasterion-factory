window.MIMIR_REGISTRY=[{
  id:"github-chatgpt-connector",
  name:"GitHub",
  type:"Connector",
  capability:["read repository","create file","update file","create branch","create pull request","inspect repo"],
  surface:"ChatGPT GitHub connector",
  installationState:"Available",
  permission:"Allowed",
  callableActions:["fetch_file","get_repo","search","create_file","update_file","create_branch","create_pull_request"],
  availability:"Available",
  constraints:["Callable exposure can change by surface/time","Runtime safety checks may still block a specific call","Star/Unstar not verified on this surface"],
  route:"GO -> MIMIR -> GitHub connector -> repository action",
  blockReason:"",
  verifiedAt:"2026-09-13",
  modifiedAt:"2026-09-13",
  source:"Live connector observations in this build room"
}];
