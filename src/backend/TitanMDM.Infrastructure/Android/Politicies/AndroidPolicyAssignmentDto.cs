namespace TitanMDM.Application.Android.Policies;

public sealed record AndroidPolicyAssignmentDto(
    Guid PolicyId,
    Guid DeviceId,
    Guid AndroidDeviceId,
    string GoogleDeviceName,
    string GooglePolicyName,
    int PolicyVersion,
    string Status,
    DateTime AssignedAtUtc,
    DateTime? VerifiedAtUtc,
    string? AppliedPolicyName,
    string? AppliedPolicyState);