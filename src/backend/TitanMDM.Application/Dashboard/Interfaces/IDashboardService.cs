using TitanMDM.Application.Dashboard.DTOs;

namespace TitanMDM.Application.Dashboard.Interfaces;

public interface IDashboardService
{
    Task<DashboardSummaryDto> GetSummaryAsync(
        Guid organizationId,
        CancellationToken cancellationToken = default);
}