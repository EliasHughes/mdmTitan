using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TitanMDM.Application.Authentication;
using TitanMDM.Application.Interfaces;
using TitanMDM.Domain.Entities;
using TitanMDM.Infrastructure.Authentication;
using TitanMDM.Infrastructure.Persistence;

namespace TitanMDM.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/auth/entra")]
public sealed class EntraLoginController : ControllerBase
{
    private readonly TitanMdmDbContext _db;
    private readonly ITokenService _tokens;
    private readonly JwtOptions _jwt;
    private readonly IConfiguration _configuration;

    public EntraLoginController(
        TitanMdmDbContext db,
        ITokenService tokens,
        IOptions<JwtOptions> jwt,
        IConfiguration configuration)
    {
        _db = db;
        _tokens = tokens;
        _jwt = jwt.Value;
        _configuration = configuration;
    }

    [HttpGet("start")]
    public IActionResult Start()
    {
        if (!_configuration.GetValue<bool>("EntraLogin:Enabled"))
            return NotFound();

        var returnUrl =
            _configuration["EntraLogin:FrontendReturnUrl"];

        if (!Uri.TryCreate(
                returnUrl,
                UriKind.Absolute,
                out var destination) ||
            destination.Scheme is not ("http" or "https"))
        {
            return StatusCode(503, new
            {
                message =
                    "Falta configurar EntraLogin:FrontendReturnUrl."
            });
        }

        return Challenge(
            new AuthenticationProperties
            {
                RedirectUri = destination.ToString()
            },
            "TitanEntraOidc");
    }

    [HttpPost("exchange")]
    public async Task<IActionResult> Exchange(
        CancellationToken cancellationToken)
    {
        if (!_configuration.GetValue<bool>("EntraLogin:Enabled"))
            return NotFound();

        var result = await HttpContext.AuthenticateAsync(
            "TitanEntraTemp");

        if (!result.Succeeded ||
            result.Principal is null)
        {
            return Unauthorized(new
            {
                message =
                    "No se recibió una autenticación válida de Microsoft."
            });
        }

        // La cookie temporal solo puede utilizarse una vez.
        await HttpContext.SignOutAsync("TitanEntraTemp");

        var objectId =
            result.Principal.FindFirst("oid")?.Value;

        var tenantId =
            result.Principal.FindFirst("tid")?.Value;

        if (!Guid.TryParse(objectId, out _) ||
            !Guid.TryParse(tenantId, out var tenantGuid) ||
            !Guid.TryParse(
                _configuration["EntraLogin:TenantId"],
                out var configuredTenant) ||
            tenantGuid != configuredTenant)
        {
            return Unauthorized(new
            {
                message =
                    "La identidad no corresponde al directorio autorizado."
            });
        }

        var account = await (
            from directoryUser in _db.EntraDirectoryUsers
            join settings in _db.EntraIdSettings
                on directoryUser.OrganizationId
                equals settings.OrganizationId
            join user in _db.Users
                on directoryUser.LinkedTitanUserId
                equals user.Id
            where directoryUser.EntraObjectId == objectId
                  && directoryUser.IsActive
                  && settings.IsEnabled
                  && settings.TenantId == tenantId
                  && settings.ClientId ==
                     _configuration["EntraLogin:ClientId"]
                  && user.OrganizationId ==
                     directoryUser.OrganizationId
                  && user.IsActive
                  && user.PasswordHash == null
            select user
        ).SingleOrDefaultAsync(cancellationToken);

        if (account is null)
        {
            return StatusCode(403, new
            {
                message =
                    "Tu identidad Microsoft todavía no tiene acceso " +
                    "individual autorizado en TitanMDM."
            });
        }

        var roles = await (
            from userRole in _db.UserRoles
            join role in _db.Roles
                on userRole.RoleId equals role.Id
            where userRole.UserId == account.Id
                  && role.OrganizationId ==
                     account.OrganizationId
                  && role.IsActive
            select role.Name
        ).Distinct().ToArrayAsync(cancellationToken);

        if (roles.Length == 0)
        {
            return StatusCode(403, new
            {
                message =
                    "Esta cuenta no tiene un rol activo en TitanMDM."
            });
        }

        var permissions = await (
            from userRole in _db.UserRoles
            join role in _db.Roles
                on userRole.RoleId equals role.Id
            join rolePermission in _db.RolePermissions
                on role.Id equals rolePermission.RoleId
            join permission in _db.Permissions
                on rolePermission.PermissionId equals permission.Id
            where userRole.UserId == account.Id
                  && role.OrganizationId ==
                     account.OrganizationId
                  && role.IsActive
                  && permission.IsActive
            select permission.Code
        ).Distinct().ToArrayAsync(cancellationToken);

        var accessExpiresAtUtc = DateTime.UtcNow.AddMinutes(
            _jwt.AccessTokenMinutes);

        var refreshExpiresAtUtc = DateTime.UtcNow.AddDays(
            _jwt.RefreshTokenDays);

        var accessToken = _tokens.GenerateAccessToken(
            account,
            roles,
            permissions,
            accessExpiresAtUtc);

        var refreshToken = _tokens.GenerateRefreshToken();

        _db.RefreshTokens.Add(
            new RefreshToken(
                account.Id,
                _tokens.HashRefreshToken(refreshToken),
                refreshExpiresAtUtc,
                HttpContext.Connection.RemoteIpAddress?.ToString()));

        account.RegisterLogin();

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(
            new LoginResponse(
                accessToken,
                accessExpiresAtUtc,
                refreshToken,
                refreshExpiresAtUtc,
                new AuthenticatedUserDto(
                    account.Id,
                    account.OrganizationId,
                    account.FirstName,
                    account.LastName,
                    account.Email,
                    roles,
                    permissions)));
    }
}