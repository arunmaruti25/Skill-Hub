$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$srcPath = Join-Path $PSScriptRoot "..\frontend\assets\logo.png"
$resDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\android\app\src\main\res"))
$brandBackground = [System.Drawing.ColorTranslator]::FromHtml("#F2F7FB")

if (-not (Test-Path $srcPath)) {
    Write-Error "Source image not found: $srcPath"
    exit 1
}

$srcImg = [System.Drawing.Image]::FromFile($srcPath)

function Resize-Image($source, $targetWidth, $targetHeight, $outPath, $fitScale = 1.0, $bgColor = [System.Drawing.Color]::Transparent) {
    $bmp = New-Object System.Drawing.Bitmap($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    if ($bgColor -ne [System.Drawing.Color]::Transparent) {
        $brush = New-Object System.Drawing.SolidBrush($bgColor)
        $g.FillRectangle($brush, 0, 0, $targetWidth, $targetHeight)
        $brush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
    }

    $drawW = [int]($targetWidth * $fitScale)
    $drawH = [int]($targetHeight * $fitScale)
    $posX = [int](($targetWidth - $drawW) / 2)
    $posY = [int](($targetHeight - $drawH) / 2)

    $g.DrawImage($source, (New-Object System.Drawing.Rectangle($posX, $posY, $drawW, $drawH)), (New-Object System.Drawing.Rectangle(0, 0, $source.Width, $source.Height)), [System.Drawing.GraphicsUnit]::Pixel)
    
    $g.Dispose()

    $parent = [System.IO.Path]::GetDirectoryName($outPath)
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated: $outPath ($targetWidth x $targetHeight)"
}


$iconSizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($folder in $iconSizes.Keys) {
    $size = $iconSizes[$folder]
    $iconPath = Join-Path $resDir "$folder\ic_launcher.png"
    $roundPath = Join-Path $resDir "$folder\ic_launcher_round.png"
    
    Resize-Image $srcImg $size $size $iconPath 0.84 $brandBackground
    Resize-Image $srcImg $size $size $roundPath 0.84 $brandBackground
}



$fgSizes = @{
    "mipmap-mdpi" = 108
    "mipmap-hdpi" = 162
    "mipmap-xhdpi" = 216
    "mipmap-xxhdpi" = 324
    "mipmap-xxxhdpi" = 432
}

foreach ($folder in $fgSizes.Keys) {
    $size = $fgSizes[$folder]
    $fgPath = Join-Path $resDir "$folder\ic_launcher_foreground.png"
    Resize-Image $srcImg $size $size $fgPath (66.0 / 108.0)
}


$splashSizes = @{
    "drawable" = @{ w = 480; h = 800; scale = 0.55 }
    "drawable-port-mdpi" = @{ w = 320; h = 480; scale = 0.55 }
    "drawable-port-hdpi" = @{ w = 480; h = 800; scale = 0.55 }
    "drawable-port-xhdpi" = @{ w = 720; h = 1280; scale = 0.55 }
    "drawable-port-xxhdpi" = @{ w = 960; h = 1600; scale = 0.55 }
    "drawable-port-xxxhdpi" = @{ w = 1280; h = 1920; scale = 0.55 }
    "drawable-land-mdpi" = @{ w = 480; h = 320; scale = 0.45 }
    "drawable-land-hdpi" = @{ w = 800; h = 480; scale = 0.45 }
    "drawable-land-xhdpi" = @{ w = 1280; h = 720; scale = 0.45 }
    "drawable-land-xxhdpi" = @{ w = 1600; h = 960; scale = 0.45 }
    "drawable-land-xxxhdpi" = @{ w = 1920; h = 1280; scale = 0.45 }
}

function Generate-Splash($source, $w, $h, $scale, $outPath) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $brush = New-Object System.Drawing.SolidBrush($brandBackground)
    $g.FillRectangle($brush, 0, 0, $w, $h)
    $brush.Dispose()

    $minDim = [Math]::Min($w, $h)
    $logoSize = [int]($minDim * $scale)
    $posX = [int](($w - $logoSize) / 2)
    $posY = [int](($h - $logoSize) / 2)

    $g.DrawImage($source, (New-Object System.Drawing.Rectangle($posX, $posY, $logoSize, $logoSize)), (New-Object System.Drawing.Rectangle(0, 0, $source.Width, $source.Height)), [System.Drawing.GraphicsUnit]::Pixel)
    
    $g.Dispose()

    $parent = [System.IO.Path]::GetDirectoryName($outPath)
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated Splash: $outPath ($w x $h)"
}

foreach ($folder in $splashSizes.Keys) {
    $cfg = $splashSizes[$folder]
    $sOut = Join-Path $resDir "$folder\splash.png"
    Generate-Splash $srcImg $cfg.w $cfg.h $cfg.scale $sOut
}

$srcImg.Dispose()
Write-Host "All icons and splash screens generated successfully!"

