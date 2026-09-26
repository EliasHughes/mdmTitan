using Microsoft.EntityFrameworkCore;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Infrastructure.Helpdesk;

public sealed class HelpdeskRoutingService
{
    private readonly TitanMdmDbContext _db;

    public HelpdeskRoutingService(TitanMdmDbContext db)
    {
        _db = db;
    }

    public async Task AssignAfterCreationAsync(
        HelpdeskTicket ticket,
        CancellationToken ct = default)
    {
        if (ticket.AssigneeUserId is not null)
            return;

        var org = ticket.OrganizationId;

        var zoneIds = await _db.HelpdeskUserZones.AsNoTracking()
            .Where(x => x.OrganizationId == org &&
                        x.UserId == ticket.RequesterUserId)
            .Select(x => x.ZoneId)
            .ToListAsync(ct);

        if (zoneIds.Count == 0)
            return;

        var teamIds = await (
            from coverage in _db.HelpdeskTeamZones.AsNoTracking()
            join team in _db.HelpdeskTeams.AsNoTracking()
                on coverage.TeamId equals team.Id
            join zone in _db.HelpdeskZones.AsNoTracking()
                on coverage.ZoneId equals zone.Id
            where coverage.OrganizationId == org &&
                  team.OrganizationId == org &&
                  zone.OrganizationId == org &&
                  team.IsActive &&
                  zone.IsActive &&
                  zoneIds.Contains(coverage.ZoneId)
            select coverage.TeamId
        ).Distinct().ToListAsync(ct);

        if (teamIds.Count == 0)
            return;

        var candidates = await (
            from member in _db.HelpdeskTeamMembers.AsNoTracking()
            join user in _db.Users.AsNoTracking()
                on member.UserId equals user.Id
            where member.OrganizationId == org &&
                  user.OrganizationId == org &&
                  user.IsActive &&
                  teamIds.Contains(member.TeamId) &&
                  member.IsAvailable &&
                  member.AcceptsAutomaticAssignments
            select new { member.UserId, member.MaxOpenTickets }
        ).ToListAsync(ct);

        var uniqueCandidates = candidates
            .GroupBy(x => x.UserId)
            .Select(g => new
            {
                UserId = g.Key,
                Capacity = g.Max(x => x.MaxOpenTickets)
            })
            .ToList();

        if (uniqueCandidates.Count == 0)
            return;

        var candidateIds = uniqueCandidates.Select(x => x.UserId).ToList();

        var workloads = await _db.HelpdeskTickets.AsNoTracking()
            .Where(x => x.OrganizationId == org &&
                        x.AssigneeUserId.HasValue &&
                        candidateIds.Contains(x.AssigneeUserId.Value) &&
                        x.Status != "resolved" &&
                        x.Status != "closed")
            .GroupBy(x => x.AssigneeUserId!.Value)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, x => x.Count, ct);

        var selected = uniqueCandidates
            .Select(x => new
            {
                x.UserId,
                x.Capacity,
                Count = workloads.GetValueOrDefault(x.UserId)
            })
            .Where(x => x.Count < x.Capacity)
            .OrderBy(x => (double)x.Count / x.Capacity)
            .ThenBy(x => x.Count)
            .ThenBy(x => x.UserId)
            .FirstOrDefault();

        if (selected is null)
            return;

        ticket.Assign(selected.UserId);

        _db.HelpdeskTicketEvents.Add(
            new HelpdeskTicketEvent(
                org,
                ticket.Id,
                null,
                "auto_assigned",
                "Ticket asignado automáticamente según cobertura y capacidad."));

        await _db.SaveChangesAsync(ct);
    }
}