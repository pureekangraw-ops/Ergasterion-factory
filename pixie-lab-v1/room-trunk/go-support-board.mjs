const clone = value => value == null ? value : structuredClone(value);

export const PIXIE_GO_SUPPORT_BOARD = "PIXIE_GO_SUPPORT_BOARD_V1";

export function projectGoSupportBoard({ missions = [], now = () => new Date().toISOString() } = {}) {
  const cards = missions.map(item => {
    const rooms = item.roomStates || [];
    const finishedRooms = rooms.filter(r => r.session?.status === "FINISHED").length;
    const activeRooms = rooms.filter(r => r.session?.status === "ACTIVE").length;
    const evidenceCount = rooms.reduce((sum,r) => sum + (r.session?.evidenceRefs?.length || 0),0);
    const unknownCount = rooms.reduce((sum,r) => sum + (r.session?.unknowns?.length || 0),0);

    const status =
      item.status === "FINISHED" ? "FINISHED" :
      finishedRooms === rooms.length && rooms.length ? "READY_FOR_GO" :
      finishedRooms > 0 ? "PARTIAL" :
      activeRooms > 0 ? "ACTIVE" :
      item.status || "UNKNOWN";

    return Object.freeze({
      missionId:item.missionId,
      mission:item.mission,
      requestedResult:item.requestedResult || null,
      status,
      assignedRooms:[...(item.assignedRooms || [])],
      finishedRooms,
      totalRooms:rooms.length,
      evidenceCount,
      unknownCount,
      rooms:rooms.map(r => ({
        roomId:r.roomId,
        status:r.session?.status || "UNKNOWN",
        traceCount:r.session?.trace?.length || 0,
        observationCount:r.session?.observations?.length || 0,
        evidenceCount:r.session?.evidenceRefs?.length || 0,
        unknownCount:r.session?.unknowns?.length || 0,
        finalResult:clone(r.session?.finalResult ?? null),
      })),
      startedAt:item.startedAt || null,
      finishedAt:item.finishedAt || null,
    });
  });

  return Object.freeze({
    contract:PIXIE_GO_SUPPORT_BOARD,
    projectionOnly:true,
    generatedFor:"GO",
    generatedAt:now(),
    counts:{
      missions:cards.length,
      active:cards.filter(x=>x.status === "ACTIVE").length,
      partial:cards.filter(x=>x.status === "PARTIAL").length,
      readyForGo:cards.filter(x=>x.status === "READY_FOR_GO").length,
      finished:cards.filter(x=>x.status === "FINISHED").length,
      unknowns:cards.reduce((sum,x)=>sum+x.unknownCount,0),
    },
    cards,
  });
}
