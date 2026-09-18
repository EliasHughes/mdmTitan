namespace TitanMDM.Infrastructure.Android;

public sealed class AndroidManagementOptions
{
    public const string SectionName = "AndroidManagement";

    public const string DefaultBaseUrl =
        "https://androidmanagement.googleapis.com/v1/";

    public const string AndroidManagementScope =
        "https://www.googleapis.com/auth/androidmanagement";

    public const string DefaultApplicationName =
        "TitanMDM Enterprise";

    /// <summary>
    /// Google Cloud project that owns the Android Enterprise resources.
    /// Example: titanmdm-enterprise
    /// </summary>
    public string ProjectId { get; set; } = string.Empty;

    /// <summary>
    /// OAuth 2.0 client ID used by TitanMDM.
    /// Never hard-code production credentials.
    /// </summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>
    /// OAuth 2.0 client secret.
    /// Development: .NET User Secrets.
    /// Production: secure secret provider.
    /// </summary>
    public string ClientSecret { get; set; } = string.Empty;

    /// <summary>
    /// Public callback used by the Android Enterprise
    /// signup workflow.
    /// </summary>
    public string CallbackUrl { get; set; } = string.Empty;

    /// <summary>
    /// Frontend destination after TitanMDM completes
    /// the Android Enterprise callback.
    /// </summary>
    public string FrontendSuccessUrl { get; set; } =
        "http://localhost:3020/enrollment?androidEnterprise=connected";

    /// <summary>
    /// Frontend destination when Android Enterprise
    /// signup fails.
    /// </summary>
    public string FrontendErrorUrl { get; set; } =
        "http://localhost:3020/enrollment?androidEnterprise=error";

    /// <summary>
    /// Android Management REST API base URL.
    /// </summary>
    public string BaseUrl { get; set; } =
        DefaultBaseUrl;

    /// <summary>
    /// Name reported by TitanMDM when communicating
    /// with Google APIs.
    /// </summary>
    public string ApplicationName { get; set; } =
        DefaultApplicationName;

    /// <summary>
    /// OAuth scope used for Android Management API.
    /// </summary>
    public string Scope { get; set; } =
        AndroidManagementScope;

    /// <summary>
    /// Timeout for calls from TitanMDM to Google.
    /// </summary>
    public int HttpTimeoutSeconds { get; set; } = 60;

    /// <summary>
    /// Number of retry attempts for transient Google
    /// API failures.
    /// </summary>
    public int MaxRetryAttempts { get; set; } = 3;

    /// <summary>
    /// Initial retry delay.
    /// Subsequent retries can use exponential backoff.
    /// </summary>
    public int InitialRetryDelaySeconds { get; set; } = 2;

    /// <summary>
    /// Default lifetime of Android enrollment tokens.
    /// </summary>
    public int DefaultEnrollmentTokenLifetimeMinutes { get; set; } =
        60;

    /// <summary>
    /// Maximum lifetime TitanMDM allows administrators
    /// to request for an enrollment token.
    /// </summary>
    public int MaximumEnrollmentTokenLifetimeMinutes { get; set; } =
        10080;

    /// <summary>
    /// Controls whether TitanMDM can create Android
    /// Enterprise signup URLs.
    /// </summary>
    public bool EnableEnterpriseSignup { get; set; } = true;

    /// <summary>
    /// Enables enrollment-token operations after an
    /// enterprise has been connected.
    /// </summary>
    public bool EnableEnrollment { get; set; } = true;

    /// <summary>
    /// Enables Android policy synchronization.
    /// </summary>
    public bool EnablePolicyManagement { get; set; } = true;

    /// <summary>
    /// Enables Android device inventory synchronization.
    /// </summary>
    public bool EnableDeviceSynchronization { get; set; } = true;

    /// <summary>
    /// Enables commands supported by Android Management API.
    /// </summary>
    public bool EnableDeviceCommands { get; set; } = true;

    /// <summary>
    /// Enables application-management functionality,
    /// including Managed Google Play integration.
    /// </summary>
    public bool EnableApplicationManagement { get; set; } = true;

    /// <summary>
    /// Enables dedicated-device/kiosk capabilities.
    /// </summary>
    public bool EnableKioskManagement { get; set; } = true;

    /// <summary>
    /// Enables compliance synchronization.
    /// </summary>
    public bool EnableComplianceSynchronization { get; set; } = true;

    /// <summary>
    /// Indicates whether Android Enterprise integration
    /// has the minimum required configuration.
    /// </summary>
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ProjectId) &&
        !string.IsNullOrWhiteSpace(ClientId) &&
        !string.IsNullOrWhiteSpace(ClientSecret);

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(ProjectId))
        {
            throw new InvalidOperationException(
                "AndroidManagement:ProjectId is required.");
        }

        if (string.IsNullOrWhiteSpace(ClientId))
        {
            throw new InvalidOperationException(
                "AndroidManagement:ClientId is required.");
        }

        if (string.IsNullOrWhiteSpace(ClientSecret))
        {
            throw new InvalidOperationException(
                "AndroidManagement:ClientSecret is required.");
        }

        if (!Uri.TryCreate(
                BaseUrl,
                UriKind.Absolute,
                out var baseUri) ||
            baseUri.Scheme != Uri.UriSchemeHttps)
        {
            throw new InvalidOperationException(
                "AndroidManagement:BaseUrl must be a valid HTTPS URL.");
        }

        if (EnableEnterpriseSignup)
        {
            if (string.IsNullOrWhiteSpace(CallbackUrl))
            {
                throw new InvalidOperationException(
                    "AndroidManagement:CallbackUrl is required when enterprise signup is enabled.");
            }

            if (!Uri.TryCreate(
                    CallbackUrl,
                    UriKind.Absolute,
                    out var callbackUri))
            {
                throw new InvalidOperationException(
                    "AndroidManagement:CallbackUrl is invalid.");
            }

            if (callbackUri.Scheme != Uri.UriSchemeHttps)
            {
                throw new InvalidOperationException(
                    "AndroidManagement:CallbackUrl must use HTTPS.");
            }
        }

        if (HttpTimeoutSeconds is < 10 or > 300)
        {
            throw new InvalidOperationException(
                "AndroidManagement:HttpTimeoutSeconds must be between 10 and 300.");
        }

        if (MaxRetryAttempts is < 0 or > 10)
        {
            throw new InvalidOperationException(
                "AndroidManagement:MaxRetryAttempts must be between 0 and 10.");
        }

        if (InitialRetryDelaySeconds is < 1 or > 60)
        {
            throw new InvalidOperationException(
                "AndroidManagement:InitialRetryDelaySeconds must be between 1 and 60.");
        }

        if (DefaultEnrollmentTokenLifetimeMinutes <= 0)
        {
            throw new InvalidOperationException(
                "AndroidManagement:DefaultEnrollmentTokenLifetimeMinutes must be greater than zero.");
        }

        if (MaximumEnrollmentTokenLifetimeMinutes <
            DefaultEnrollmentTokenLifetimeMinutes)
        {
            throw new InvalidOperationException(
                "AndroidManagement:MaximumEnrollmentTokenLifetimeMinutes cannot be less than the default lifetime.");
        }

        if (string.IsNullOrWhiteSpace(Scope))
        {
            throw new InvalidOperationException(
                "AndroidManagement:Scope is required.");
        }
    }
}