Add-Type -AssemblyName System.Drawing

function New-DosNostalgiaBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.Clear([System.Drawing.Color]::FromArgb(255, 0, 0, 170))

  $s = $size / 64.0
  $border = [Math]::Max(1, [int](3 * $s))
  $penWhite = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), $border
  $bx = [int](3 * $s)
  $by = [int](3 * $s)
  $bw = [int](58 * $s) - 1
  $bh = [int](58 * $s) - 1
  $g.DrawRectangle($penWhite, $bx, $by, $bw, $bh)

  $brushGray = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 192, 192, 192))
  $g.FillRectangle($brushGray, [int](8 * $s), [int](8 * $s), [int](48 * $s), [int](12 * $s))

  $brushBlue = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 0, 170))
  $brushRed = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 170, 0, 0))
  $brushGreen = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 170, 0))
  $g.FillRectangle($brushBlue, [int](11 * $s), [int](11 * $s), [int](6 * $s), [int](6 * $s))
  $g.FillRectangle($brushRed, [int](19 * $s), [int](11 * $s), [int](6 * $s), [int](6 * $s))
  $g.FillRectangle($brushGreen, [int](27 * $s), [int](11 * $s), [int](6 * $s), [int](6 * $s))

  $brushYellow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 255, 255, 85))
  $fontSize = [Math]::Max(8, [int](18 * $s))
  $font = New-Object System.Drawing.Font 'Courier New', $fontSize, ([System.Drawing.FontStyle]::Bold)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $top = [float](28 * $s)
  $height = [float](20 * $s)
  $rect = New-Object System.Drawing.RectangleF([float]0, $top, [float]$size, $height)
  $g.DrawString('DN', $font, $brushYellow, $rect, $sf)

  $brushCyan = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 85, 255, 255))
  $g.FillRectangle($brushCyan, [int](28 * $s), [int](48 * $s), [int](8 * $s), [int](8 * $s))

  $g.Dispose()
  $penWhite.Dispose()
  $brushGray.Dispose()
  $brushBlue.Dispose()
  $brushRed.Dispose()
  $brushGreen.Dispose()
  $brushYellow.Dispose()
  $brushCyan.Dispose()
  $font.Dispose()
  $sf.Dispose()
  return $bmp
}

function Save-Ico([string]$path, $bitmaps) {
  $ms = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter $ms
  $bw.Write([uint16]0)
  $bw.Write([uint16]1)
  $bw.Write([uint16]$bitmaps.Count)

  $imageData = New-Object System.Collections.Generic.List[byte[]]
  foreach ($b in $bitmaps) {
    $pngMs = New-Object System.IO.MemoryStream
    $b.Save($pngMs, [System.Drawing.Imaging.ImageFormat]::Png)
    [void]$imageData.Add($pngMs.ToArray())
    $pngMs.Dispose()
  }

  $offset = 6 + (16 * $bitmaps.Count)
  for ($i = 0; $i -lt $bitmaps.Count; $i++) {
    $b = $bitmaps[$i]
    $w = if ($b.Width -ge 256) { 0 } else { $b.Width }
    $h = if ($b.Height -ge 256) { 0 } else { $b.Height }
    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]$imageData[$i].Length)
    $bw.Write([uint32]$offset)
    $offset += $imageData[$i].Length
  }
  foreach ($d in $imageData) {
    $bw.Write($d)
  }
  $bw.Flush()
  [System.IO.File]::WriteAllBytes($path, $ms.ToArray())
  $bw.Dispose()
  $ms.Dispose()
}

$root = Split-Path -Parent $PSScriptRoot
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$bmps = @()
foreach ($sz in $sizes) {
  $bmps += New-DosNostalgiaBitmap $sz
}

$png256 = New-DosNostalgiaBitmap 256
$png256.Save((Join-Path $root 'resources\icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$png256.Save((Join-Path $root 'build\icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$png256.Dispose()

Save-Ico (Join-Path $root 'build\icon.ico') $bmps
foreach ($b in $bmps) { $b.Dispose() }

Write-Output 'Generated resources/icon.png, build/icon.png, build/icon.ico'
