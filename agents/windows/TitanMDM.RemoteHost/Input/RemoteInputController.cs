using System.ComponentModel;
using System.Runtime.InteropServices;

namespace TitanMDM.RemoteHost.Input;

public sealed class RemoteInputController
{
    private const uint InputMouse =
        0;

    private const uint InputKeyboard =
        1;

    private const uint MouseMove =
        0x0001;

    private const uint MouseLeftDown =
        0x0002;

    private const uint MouseLeftUp =
        0x0004;

    private const uint MouseRightDown =
        0x0008;

    private const uint MouseRightUp =
        0x0010;

    private const uint MouseWheel =
        0x0800;

    private const uint MouseAbsolute =
        0x8000;

    private const uint MouseVirtualDesk =
        0x4000;

    private const uint KeyboardKeyUp =
        0x0002;

    public void MovePointer(
        double normalizedX,
        double normalizedY)
    {
        var x =
            (int)Math.Round(
                Math.Clamp(
                    normalizedX,
                    0d,
                    1d)
                * 65535d);

        var y =
            (int)Math.Round(
                Math.Clamp(
                    normalizedY,
                    0d,
                    1d)
                * 65535d);

        SendMouse(
            x,
            y,
            0,
            MouseMove |
            MouseAbsolute |
            MouseVirtualDesk);
    }

    public void LeftDown()
    {
        SendMouse(
            0,
            0,
            0,
            MouseLeftDown);
    }

    public void LeftUp()
    {
        SendMouse(
            0,
            0,
            0,
            MouseLeftUp);
    }

    public void RightDown()
    {
        SendMouse(
            0,
            0,
            0,
            MouseRightDown);
    }

    public void RightUp()
    {
        SendMouse(
            0,
            0,
            0,
            MouseRightUp);
    }

    public void Wheel(
        int delta)
    {
        SendMouse(
            0,
            0,
            unchecked(
                (uint)delta),
            MouseWheel);
    }

    public void KeyDown(
        ushort virtualKey)
    {
        SendKeyboard(
            virtualKey,
            0);
    }

    public void KeyUp(
        ushort virtualKey)
    {
        SendKeyboard(
            virtualKey,
            KeyboardKeyUp);
    }

    private static void SendMouse(
        int dx,
        int dy,
        uint mouseData,
        uint flags)
    {
        var input =
            new NativeInput
            {
                Type =
                    InputMouse,

                Data =
                    new InputUnion
                    {
                        Mouse =
                            new MouseInput
                            {
                                Dx =
                                    dx,

                                Dy =
                                    dy,

                                MouseData =
                                    mouseData,

                                Flags =
                                    flags,

                                Time =
                                    0,

                                ExtraInfo =
                                    IntPtr.Zero
                            }
                    }
            };

        Send(
            input);
    }

    private static void SendKeyboard(
        ushort virtualKey,
        uint flags)
    {
        var input =
            new NativeInput
            {
                Type =
                    InputKeyboard,

                Data =
                    new InputUnion
                    {
                        Keyboard =
                            new KeyboardInput
                            {
                                VirtualKey =
                                    virtualKey,

                                ScanCode =
                                    0,

                                Flags =
                                    flags,

                                Time =
                                    0,

                                ExtraInfo =
                                    IntPtr.Zero
                            }
                    }
            };

        Send(
            input);
    }

    private static void Send(
        NativeInput input)
    {
        var inputs =
            new[]
            {
                input
            };

        var sent =
            SendInput(
                1,
                inputs,
                Marshal.SizeOf<
                    NativeInput>());

        if (sent == 1)
        {
            return;
        }

        throw new Win32Exception(
            Marshal.GetLastWin32Error(),
            "Windows rechazó el evento de entrada remota.");
    }

    [DllImport(
        "user32.dll",
        SetLastError = true)]
    private static extern uint SendInput(
        uint numberOfInputs,
        NativeInput[] inputs,
        int structureSize);

    [StructLayout(
        LayoutKind.Sequential)]
    private struct NativeInput
    {
        public uint Type;

        public InputUnion Data;
    }

    [StructLayout(
        LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)]
        public MouseInput Mouse;

        [FieldOffset(0)]
        public KeyboardInput Keyboard;
    }

    [StructLayout(
        LayoutKind.Sequential)]
    private struct MouseInput
    {
        public int Dx;

        public int Dy;

        public uint MouseData;

        public uint Flags;

        public uint Time;

        public IntPtr ExtraInfo;
    }

    [StructLayout(
        LayoutKind.Sequential)]
    private struct KeyboardInput
    {
        public ushort VirtualKey;

        public ushort ScanCode;

        public uint Flags;

        public uint Time;

        public IntPtr ExtraInfo;
    }
}