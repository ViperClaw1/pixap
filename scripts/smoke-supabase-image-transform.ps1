# Smoke-test Storage Image Transformations for project ylcyktbppowabnxuwdrr (pix).
# Usage: .\scripts\smoke-supabase-image-transform.ps1
# Expect 200 after Pro + Dashboard → Storage → Image Transformations enabled.

$ProjectRef = "ylcyktbppowabnxuwdrr"
$SamplePath = "logo/icon.png"
$Url = "https://$ProjectRef.supabase.co/storage/v1/render/image/public/$SamplePath`?width=128&quality=75"

Write-Host "GET $Url"
try {
  $resp = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing
  Write-Host "Status: $($resp.StatusCode) — transforms OK"
  exit 0
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host "Status: $code — enable Image Transformations in Supabase Dashboard (Pro plan)"
  exit 1
}
