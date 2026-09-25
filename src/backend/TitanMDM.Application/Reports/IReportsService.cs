namespace TitanMDM.Application.Reports;

public interface IReportsService
{
    Task<ReportsOverviewDto>
        GetOverviewAsync(
            Guid organizationId,
            CancellationToken cancellationToken = default);

    Task<byte[]> ExportDevicesCsvAsync(
        Guid organizationId,
        CancellationToken cancellationToken = default);
}