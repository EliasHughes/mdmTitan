using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace TitanMDM.WindowsAgent.Interop;

public sealed class ActiveSessionProcessLauncher
{
    private const uint TokenAssignPrimary = 0x0001;
    private const uint TokenDuplicate = 0x0002;
    private const uint TokenQuery = 0x0008;
    private const uint TokenAdjustDefault = 0x0080;
    private const uint TokenAdjustSessionId = 0x0100;

    private const uint CreateUnicodeEnvironment = 0x00000400;

    private const int SecurityImpersonation = 2;
    private const int TokenPrimary = 1;

    public ProcessLaunchResult Launch(
        string executablePath,
        string arguments,
        string? workingDirectory = null)
    {
        if (!File.Exists(executablePath))
        {
            throw new FileNotFoundException(
                "TitanMDM no encontró el ejecutable que debe iniciar en la sesión interactiva.",
                executablePath);
        }

        var sessionId =
            WTSGetActiveConsoleSessionId();

        if (sessionId == uint.MaxValue)
        {
            throw new InvalidOperationException(
                "Windows no tiene una sesión interactiva activa.");
        }

        IntPtr userToken = IntPtr.Zero;
        IntPtr primaryToken = IntPtr.Zero;
        IntPtr environment = IntPtr.Zero;

        try
        {
            if (!WTSQueryUserToken(
                    sessionId,
                    out userToken))
            {
                ThrowWin32(
                    "No fue posible obtener el token de la sesión Windows activa.");
            }

            var desiredAccess =
                TokenAssignPrimary |
                TokenDuplicate |
                TokenQuery |
                TokenAdjustDefault |
                TokenAdjustSessionId;

            if (!DuplicateTokenEx(
                    userToken,
                    desiredAccess,
                    IntPtr.Zero,
                    SecurityImpersonation,
                    TokenPrimary,
                    out primaryToken))
            {
                ThrowWin32(
                    "No fue posible duplicar el token del usuario.");
            }

            if (!CreateEnvironmentBlock(
                    out environment,
                    primaryToken,
                    false))
            {
                ThrowWin32(
                    "No fue posible crear el entorno del usuario.");
            }

            var startupInfo =
                new StartupInfo
                {
                    Cb =
                        Marshal.SizeOf<StartupInfo>(),

                    Desktop =
                        @"winsta0\default"
                };

            var commandLine =
                new StringBuilder();

            commandLine.Append('"');
            commandLine.Append(executablePath);
            commandLine.Append('"');

            if (!string.IsNullOrWhiteSpace(arguments))
            {
                commandLine.Append(' ');
                commandLine.Append(arguments);
            }

            var currentDirectory =
                string.IsNullOrWhiteSpace(
                    workingDirectory)
                    ? Path.GetDirectoryName(
                        executablePath)
                    : workingDirectory;

            if (!CreateProcessAsUser(
                    primaryToken,
                    null,
                    commandLine,
                    IntPtr.Zero,
                    IntPtr.Zero,
                    false,
                    CreateUnicodeEnvironment,
                    environment,
                    currentDirectory,
                    ref startupInfo,
                    out var processInformation))
            {
                ThrowWin32(
                    "Windows no pudo iniciar TitanMDM RemoteHost en la sesión interactiva.");
            }

            try
            {
                return new ProcessLaunchResult(
                    checked(
                        (int)processInformation.ProcessId),
                    checked(
                        (int)sessionId));
            }
            finally
            {
                CloseHandleSafe(
                    processInformation.Thread);

                CloseHandleSafe(
                    processInformation.Process);
            }
        }
        finally
        {
            if (environment != IntPtr.Zero)
            {
                DestroyEnvironmentBlock(
                    environment);
            }

            CloseHandleSafe(
                primaryToken);

            CloseHandleSafe(
                userToken);
        }
    }

    private static void ThrowWin32(
        string message)
    {
        var error =
            Marshal.GetLastWin32Error();

        throw new Win32Exception(
            error,
            $"{message} Código Win32: {error}.");
    }

    private static void CloseHandleSafe(
        IntPtr handle)
    {
        if (handle != IntPtr.Zero)
        {
            CloseHandle(handle);
        }
    }

    [DllImport(
        "kernel32.dll")]
    private static extern uint
        WTSGetActiveConsoleSessionId();

    [DllImport(
        "wtsapi32.dll",
        SetLastError = true)]
    private static extern bool
        WTSQueryUserToken(
            uint sessionId,
            out IntPtr token);

    [DllImport(
        "advapi32.dll",
        SetLastError = true)]
    private static extern bool
        DuplicateTokenEx(
            IntPtr existingToken,
            uint desiredAccess,
            IntPtr tokenAttributes,
            int impersonationLevel,
            int tokenType,
            out IntPtr newToken);

    [DllImport(
        "userenv.dll",
        SetLastError = true)]
    private static extern bool
        CreateEnvironmentBlock(
            out IntPtr environment,
            IntPtr token,
            bool inherit);

    [DllImport(
        "userenv.dll",
        SetLastError = true)]
    private static extern bool
        DestroyEnvironmentBlock(
            IntPtr environment);

    [DllImport(
        "advapi32.dll",
        SetLastError = true,
        CharSet = CharSet.Unicode)]
    private static extern bool
        CreateProcessAsUser(
            IntPtr token,
            string? applicationName,
            StringBuilder commandLine,
            IntPtr processAttributes,
            IntPtr threadAttributes,
            bool inheritHandles,
            uint creationFlags,
            IntPtr environment,
            string? currentDirectory,
            ref StartupInfo startupInfo,
            out ProcessInformation processInformation);

    [DllImport(
        "kernel32.dll",
        SetLastError = true)]
    private static extern bool
        CloseHandle(
            IntPtr handle);

    [StructLayout(
        LayoutKind.Sequential,
        CharSet = CharSet.Unicode)]
    private struct StartupInfo
    {
        public int Cb;

        public string? Reserved;

        public string? Desktop;

        public string? Title;

        public uint X;

        public uint Y;

        public uint XSize;

        public uint YSize;

        public uint XCountChars;

        public uint YCountChars;

        public uint FillAttribute;

        public uint Flags;

        public ushort ShowWindow;

        public ushort Reserved2;

        public IntPtr Reserved2Pointer;

        public IntPtr StdInput;

        public IntPtr StdOutput;

        public IntPtr StdError;
    }

    [StructLayout(
        LayoutKind.Sequential)]
    private struct ProcessInformation
    {
        public IntPtr Process;

        public IntPtr Thread;

        public uint ProcessId;

        public uint ThreadId;
    }
}

public sealed record ProcessLaunchResult(
    int ProcessId,
    int WindowsSessionId);