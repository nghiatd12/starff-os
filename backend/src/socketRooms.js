export function roleRoom(tenantId, role) {
  return `tenant:${tenantId}:${role}`
}

export function emitToRoles(io, tenantId, roles, event, payload) {
  let target = io
  for (const role of roles) {
    target = target.to(roleRoom(tenantId, role))
  }
  target.emit(event, payload)
}
