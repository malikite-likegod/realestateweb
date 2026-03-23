export function BrokerageAttribution({
  listAgentFullName,
  listOfficeName,
}: {
  listAgentFullName?: string | null
  listOfficeName?: string | null
}) {
  if (!listAgentFullName && !listOfficeName) return null
  return (
    <p className="text-sm text-charcoal-500 mt-2">
      {listAgentFullName && <span>Listed by <strong className="text-charcoal-700">{listAgentFullName}</strong></span>}
      {listAgentFullName && listOfficeName && <span> · </span>}
      {listOfficeName && <span><strong className="text-charcoal-700">{listOfficeName}</strong></span>}
    </p>
  )
}
