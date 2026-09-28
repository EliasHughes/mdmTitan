using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/helpdesk/reports")]
public sealed class HelpdeskReportsController : ControllerBase
{
    private readonly TitanMdmDbContext _db;

    public HelpdeskReportsController(TitanMdmDbContext db)
    {
        _db = db;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken cancellationToken)
    {
        if (!CanViewReports())
            return Forbid();

        if (!TryGetOrganization(out var organizationId))
            return Unauthorized();

        if (!TryGetRange(from, to, out var start, out var end))
        {
            return BadRequest(new
            {
                message =
                    "El rango debe ser válido y no superar 366 días."
            });
        }

        var tickets = await _db.HelpdeskTickets
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                x.CreatedAtUtc >= start &&
                x.CreatedAtUtc < end)
            .Select(x => new
            {
                x.Id,
                x.Number,
                x.Subject,
                x.Status,
                x.Priority,
                x.Category,
                x.Source,
                x.AssigneeUserId,
                x.CreatedAtUtc,
                x.FirstRespondedAtUtc,
                x.FirstResponseDueAtUtc,
                x.ResolvedAtUtc,
                x.ResolveDueAtUtc
            })
            .ToListAsync(cancellationToken);

        var assigneeIds = tickets
            .Where(x => x.AssigneeUserId.HasValue)
            .Select(x => x.AssigneeUserId!.Value)
            .Distinct()
            .ToArray();

        var names = await _db.Users
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                assigneeIds.Contains(x.Id))
            .Select(x => new
            {
                x.Id,
                x.FirstName,
                x.LastName
            })
            .ToDictionaryAsync(
                x => x.Id,
                x => (x.FirstName + " " + x.LastName).Trim(),
                cancellationToken);

        var firstResponses = tickets
            .Where(x => x.FirstRespondedAtUtc.HasValue)
            .Select(x =>
                (x.FirstRespondedAtUtc!.Value -
                 x.CreatedAtUtc).TotalHours)
            .Where(x => x >= 0)
            .ToArray();

        var resolutions = tickets
            .Where(x => x.ResolvedAtUtc.HasValue)
            .Select(x =>
                (x.ResolvedAtUtc!.Value -
                 x.CreatedAtUtc).TotalHours)
            .Where(x => x >= 0)
            .ToArray();

        var unresolved = tickets.Count(x =>
            x.Status is not ("resolved" or "closed"));

        var overdueFirstResponse = tickets.Count(x =>
            !x.FirstRespondedAtUtc.HasValue &&
            x.FirstResponseDueAtUtc.HasValue &&
            x.FirstResponseDueAtUtc.Value < DateTime.UtcNow &&
            x.Status is not ("resolved" or "closed"));

        var overdueResolution = tickets.Count(x =>
            !x.ResolvedAtUtc.HasValue &&
            x.ResolveDueAtUtc.HasValue &&
            x.ResolveDueAtUtc.Value < DateTime.UtcNow &&
            x.Status is not ("resolved" or "closed"));

        var byStatus = tickets
            .GroupBy(x => x.Status)
            .Select(x => new
            {
                label = x.Key,
                count = x.Count()
            })
            .OrderByDescending(x => x.count)
            .ToArray();

        var byPriority = tickets
            .GroupBy(x => x.Priority)
            .Select(x => new
            {
                label = x.Key,
                count = x.Count()
            })
            .OrderByDescending(x => x.count)
            .ToArray();

        var byCategory = tickets
            .GroupBy(x => x.Category)
            .Select(x => new
            {
                label = x.Key,
                count = x.Count()
            })
            .OrderByDescending(x => x.count)
            .Take(12)
            .ToArray();

        var bySource = tickets
            .GroupBy(x => x.Source)
            .Select(x => new
            {
                label = x.Key,
                count = x.Count()
            })
            .OrderByDescending(x => x.count)
            .ToArray();

        var byAgent = tickets
            .GroupBy(x => x.AssigneeUserId)
            .Select(x => new
            {
                label = x.Key.HasValue &&
                        names.TryGetValue(x.Key.Value, out var name)
                    ? name
                    : "Sin asignar",
                count = x.Count(),
                resolved = x.Count(ticket =>
                    ticket.Status is "resolved" or "closed")
            })
            .OrderByDescending(x => x.count)
            .Take(15)
            .ToArray();

        var daily = tickets
            .GroupBy(x => DateOnly.FromDateTime(x.CreatedAtUtc))
            .Select(x => new
            {
                date = x.Key.ToString("yyyy-MM-dd"),
                count = x.Count()
            })
            .OrderBy(x => x.date)
            .ToArray();

        return Ok(new
        {
            from = DateOnly.FromDateTime(start),
            to = DateOnly.FromDateTime(end.AddDays(-1)),
            total = tickets.Count,
            unresolved,
            unassigned = tickets.Count(x =>
                !x.AssigneeUserId.HasValue),
            overdueFirstResponse,
            overdueResolution,
            averageFirstResponseHours =
                firstResponses.Length == 0
                    ? (double?)null
                    : Math.Round(firstResponses.Average(), 1),
            averageResolutionHours =
                resolutions.Length == 0
                    ? (double?)null
                    : Math.Round(resolutions.Average(), 1),
            byStatus,
            byPriority,
            byCategory,
            bySource,
            byAgent,
            daily,
            generatedAtUtc = DateTime.UtcNow
        });
    }

    [HttpGet("tickets.csv")]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken cancellationToken)
    {
        if (!CanViewReports())
            return Forbid();

        if (!TryGetOrganization(out var organizationId))
            return Unauthorized();

        if (!TryGetRange(from, to, out var start, out var end))
        {
            return BadRequest(new
            {
                message =
                    "El rango debe ser válido y no superar 366 días."
            });
        }

        var tickets = await _db.HelpdeskTickets
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                x.CreatedAtUtc >= start &&
                x.CreatedAtUtc < end)
            .OrderBy(x => x.CreatedAtUtc)
            .Select(x => new
            {
                x.Number,
                x.Subject,
                x.Status,
                x.Priority,
                x.Category,
                x.Source,
                x.AssigneeUserId,
                x.ExternalRequesterEmail,
                x.CreatedAtUtc,
                x.FirstRespondedAtUtc,
                x.ResolvedAtUtc
            })
            .ToListAsync(cancellationToken);

        var assigneeIds = tickets
            .Where(x => x.AssigneeUserId.HasValue)
            .Select(x => x.AssigneeUserId!.Value)
            .Distinct()
            .ToArray();

        var names = await _db.Users
            .AsNoTracking()
            .Where(x =>
                x.OrganizationId == organizationId &&
                assigneeIds.Contains(x.Id))
            .Select(x => new
            {
                x.Id,
                x.FirstName,
                x.LastName
            })
            .ToDictionaryAsync(
                x => x.Id,
                x => (x.FirstName + " " + x.LastName).Trim(),
                cancellationToken);

        var csv = new StringBuilder();

        csv.AppendLine(
            "Numero,Asunto,Estado,Prioridad,Categoria,Origen," +
            "Agente,Correo externo,Creado UTC," +
            "Primera respuesta UTC,Resuelto UTC");

        foreach (var ticket in tickets)
        {
            var agent = ticket.AssigneeUserId.HasValue &&
                        names.TryGetValue(
                            ticket.AssigneeUserId.Value,
                            out var name)
                ? name
                : "";

            csv.AppendLine(string.Join(",", new[]
            {
                Cell(ticket.Number),
                Cell(ticket.Subject),
                Cell(ticket.Status),
                Cell(ticket.Priority),
                Cell(ticket.Category),
                Cell(ticket.Source),
                Cell(agent),
                Cell(ticket.ExternalRequesterEmail),
                Cell(ticket.CreatedAtUtc.ToString("O")),
                Cell(ticket.FirstRespondedAtUtc?.ToString("O")),
                Cell(ticket.ResolvedAtUtc?.ToString("O"))
            }));
        }

        var bytes = new UTF8Encoding(true)
            .GetPreamble()
            .Concat(Encoding.UTF8.GetBytes(csv.ToString()))
            .ToArray();

        return File(
            bytes,
            "text/csv; charset=utf-8",
            $"titanmdm-helpdesk-{start:yyyyMMdd}-" +
            $"{end.AddDays(-1):yyyyMMdd}.csv");
    }

    private bool CanViewReports()
    {
        return User.Claims.Any(claim =>
            claim.Type == "permission" &&
            (string.Equals(
                 claim.Value,
                 "helpdesk.view",
                 StringComparison.OrdinalIgnoreCase) ||
             string.Equals(
                 claim.Value,
                 "tickets.view",
                 StringComparison.OrdinalIgnoreCase)));
    }

    private bool TryGetOrganization(out Guid organizationId)
    {
        var value =
            User.FindFirstValue("organization_id") ??
            User.FindFirstValue("organizationId");

        return Guid.TryParse(value, out organizationId);
    }

    private static bool TryGetRange(
        DateOnly? from,
        DateOnly? to,
        out DateTime start,
        out DateTime end)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var first = from ?? today.AddDays(-29);
        var last = to ?? today;

        start = DateTime.SpecifyKind(
            first.ToDateTime(TimeOnly.MinValue),
            DateTimeKind.Utc);

        end = DateTime.SpecifyKind(
            last.AddDays(1).ToDateTime(TimeOnly.MinValue),
            DateTimeKind.Utc);

        return last >= first &&
               last <= today &&
               last.DayNumber - first.DayNumber <= 365;
    }

    private static string Cell(string? value)
    {
        var text = (value ?? "")
            .Replace("\r", " ")
            .Replace("\n", " ");

        // Impide interpretar contenido de tickets como fórmula al abrir CSV.
        if (text.Length > 0 &&
            "=+-@\t".Contains(text[0]))
        {
            text = "'" + text;
        }

        return "\"" + text.Replace("\"", "\"\"") + "\"";
    }
}