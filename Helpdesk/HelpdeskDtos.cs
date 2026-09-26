
namespace TitanMDM.Application.Helpdesk;

public sealed record HelpdeskTicketListItemDto(
    Guid Id,
    string Number,
    string Subject,
    string Status,
    string Priority,
    string Type,
    string Category,
    string Source,
    Guid RequesterUserId,
    string RequesterName,
    Guid? AssigneeUserId,
    string? AssigneeName,
    Guid? DeviceId,
    string? DeviceName,
    string? DevicePlatform,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    DateTime? FirstResponseDueAtUtc,
    DateTime? ResolveDueAtUtc,
    bool SlaBreached);

public sealed record HelpdeskTicketDetailsDto(
    Guid Id,
    string Number,
    string Subject,
    string Description,
    string Status,
    string Priority,
    string Type,
    string Category,
    string Source,
    Guid RequesterUserId,
    string RequesterName,
    Guid? AssigneeUserId,
    string? AssigneeName,
    Guid? DeviceId,
    string? DeviceName,
    string? DevicePlatform,
    Guid? RemoteSessionId,
    string? EntraUserPrincipalName,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    IReadOnlyList<HelpdeskCommentDto> Comments,
    IReadOnlyList<HelpdeskEventDto> Timeline);

public sealed record HelpdeskCommentDto(
    Guid Id,
    Guid AuthorUserId,
    string AuthorName,
    string Body,
    bool IsInternal,
    DateTime CreatedAtUtc);

public sealed record HelpdeskEventDto(
    Guid Id,
    string EventType,
    string Summary,
    DateTime CreatedAtUtc);

public sealed record CreateHelpdeskTicketRequest(
    string Subject,
    string Description,
    string? Type,
    string? Priority,
    string? Category,
    string? Source,
    Guid? DeviceId,
    Guid? RequesterUserId,
    string? EntraObjectId);

public sealed record AddHelpdeskCommentRequest(
    string Body,
    bool IsInternal);

public sealed record AssignHelpdeskTicketRequest(
    Guid AssigneeUserId);

public sealed record TransitionHelpdeskTicketRequest(
    string Status);

public sealed record HelpdeskTicketQuery(
    string? Search,
    string? Status,
    string? Priority,
    Guid? DeviceId,
    Guid? AssigneeUserId,
    int Page = 1,
    int PageSize = 25);

public sealed record HelpdeskTicketListResult(
    IReadOnlyList<HelpdeskTicketListItemDto> Items,
    int Total,
    int Page,
    int PageSize);

public sealed record EntraIdSettingsDto(
    bool IsEnabled,
    string? TenantId,
    string? ClientId,
    bool HasClientSecret,
    string? AllowedGroupIds,
    bool SyncRequestersOnly,
    DateTime? LastSyncAtUtc,
    string? LastSyncStatus);

public sealed record SaveEntraIdSettingsRequest(
    bool IsEnabled,
    string TenantId,
    string ClientId,
    string? ClientSecret,
    string? AllowedGroupIds,
    bool SyncRequestersOnly);

public sealed record EntraDirectoryUserDto(
    Guid Id,
    string EntraObjectId,
    string DisplayName,
    string UserPrincipalName,
    string? Mail,
    string? JobTitle,
    string? Department,
    Guid? LinkedTitanUserId,
    bool IsActive);

public sealed record EntraSyncResultDto(
    int Imported,
    int Updated,
    int LinkedToExistingUsers,
    string Status);
