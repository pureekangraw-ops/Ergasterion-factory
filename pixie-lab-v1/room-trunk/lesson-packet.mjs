const text = value => String(value ?? "").trim();
const unique = values => [...new Set((values || []).map(text).filter(Boolean))];

export const PIXIE_LESSON_PACKET = "PIXIE_LESSON_PACKET_V1";

export function createLessonPacket({
  sourceRoom,
  sessionId,
  topic,
  reusable = [],
  evidenceRefs = [],
  unknowns = [],
} = {}) {
  const room = text(sourceRoom);
  const session = text(sessionId);
  const subject = text(topic);
  if (!room) throw new Error("SOURCE_ROOM_REQUIRED");
  if (!session) throw new Error("SESSION_ID_REQUIRED");
  if (!subject) throw new Error("TOPIC_REQUIRED");

  return Object.freeze({
    contract:PIXIE_LESSON_PACKET,
    sourceRoom:room,
    sessionId:session,
    topic:subject,
    reusable:Object.freeze(unique(reusable)),
    evidenceRefs:Object.freeze(unique(evidenceRefs)),
    unknowns:Object.freeze(unique(unknowns)),
    transfer:Object.freeze({
      carriesWorkingState:false,
      carriesAssumptions:false,
      carriesAuthority:false,
      autoAdopts:false,
      evidenceOnly:true,
    }),
  });
}

export function assertLessonPacket(packet) {
  if (!packet || packet.contract !== PIXIE_LESSON_PACKET) throw new Error("PIXIE_LESSON_PACKET_REQUIRED");
  return packet;
}
