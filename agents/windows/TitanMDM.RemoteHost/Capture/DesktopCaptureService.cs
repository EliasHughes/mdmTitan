using System.Drawing.Imaging;

namespace TitanMDM.RemoteHost.Capture;

public sealed class DesktopCaptureService
{
    private long _sequence;

    public DesktopCaptureResult Capture(
        int jpegQuality = 65)
    {
        var screen =
            Screen.PrimaryScreen
            ?? throw new InvalidOperationException(
                "No existe una pantalla interactiva disponible.");

        var bounds =
            screen.Bounds;

        if (bounds.Width <= 0 ||
            bounds.Height <= 0)
        {
            throw new InvalidOperationException(
                "La pantalla activa posee dimensiones no válidas.");
        }

        using var bitmap =
            new Bitmap(
                bounds.Width,
                bounds.Height,
                PixelFormat.Format24bppRgb);

        using (var graphics =
               Graphics.FromImage(
                   bitmap))
        {
            graphics.CopyFromScreen(
                bounds.Left,
                bounds.Top,
                0,
                0,
                bounds.Size,
                CopyPixelOperation.SourceCopy);
        }

        using var stream =
            new MemoryStream();

        var codec =
            ImageCodecInfo
                .GetImageEncoders()
                .FirstOrDefault(
                    x =>
                        x.FormatID ==
                        ImageFormat.Jpeg.Guid)
            ?? throw new InvalidOperationException(
                "Windows no dispone del codificador JPEG requerido.");

        using var parameters =
            new EncoderParameters(1);

        parameters.Param[0] =
            new EncoderParameter(
                Encoder.Quality,
                (long)Math.Clamp(
                    jpegQuality,
                    20,
                    95));

        bitmap.Save(
            stream,
            codec,
            parameters);

        return new DesktopCaptureResult(
            Sequence:
                Interlocked.Increment(
                    ref _sequence),

            Width:
                bounds.Width,

            Height:
                bounds.Height,

            MimeType:
                "image/jpeg",

            Data:
                stream.ToArray(),

            CapturedAtUtc:
                DateTime.UtcNow);
    }
}

public sealed record DesktopCaptureResult(
    long Sequence,
    int Width,
    int Height,
    string MimeType,
    byte[] Data,
    DateTime CapturedAtUtc);