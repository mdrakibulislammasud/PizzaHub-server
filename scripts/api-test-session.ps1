$global:PizzaHubBaseUrl = "http://localhost:5000"

function Connect-PizzaHubVendor {
    param(
        [string]$Email = "test-vendor@example.com"
    )

    $securePassword = Read-Host "Enter vendor password" -AsSecureString
    $credential = [System.Management.Automation.PSCredential]::new(
        $Email,
        $securePassword
    )

    $plainPassword = $credential.GetNetworkCredential().Password

    try {
        $global:PizzaHubSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession

        $loginBody = @{
            email    = $Email
            password = $plainPassword
        } | ConvertTo-Json

        Invoke-RestMethod `
            -Uri "$global:PizzaHubBaseUrl/api/auth/sign-in/email" `
            -Method Post `
            -Body $loginBody `
            -ContentType "application/json" `
            -WebSession $global:PizzaHubSession | Out-Null

        $global:PizzaHubEmail = $Email

        Refresh-PizzaHubToken

        Write-Host "PizzaHub Vendor login successful." -ForegroundColor Green
    }
    catch {
        $global:PizzaHubSession = $null
        $global:PizzaHubToken = $null
        $global:PizzaHubHeaders = $null
        Write-Host "Login failed. Check the credentials and server." -ForegroundColor Red
        throw
    }
    finally {
        $plainPassword = $null
        $loginBody = $null
        $credential = $null
    }
}

function Refresh-PizzaHubToken {
    if (-not $global:PizzaHubSession) {
        throw "No login session. Run Connect-PizzaHubVendor first."
    }

    $tokenResponse = Invoke-RestMethod `
        -Uri "$global:PizzaHubBaseUrl/api/auth/token" `
        -Method Get `
        -WebSession $global:PizzaHubSession

    if (-not $tokenResponse.token) {
        throw "JWT was not returned by Better Auth."
    }

    $global:PizzaHubToken = $tokenResponse.token
    $global:PizzaHubHeaders = @{
        Authorization = "Bearer $global:PizzaHubToken"
    }

    Write-Host "JWT refreshed successfully." -ForegroundColor Green
}

function Invoke-PizzaHubApi {
    param(
        [Parameter(Mandatory)]
        [string]$Path,

        [ValidateSet("Get", "Post", "Patch", "Put", "Delete")]
        [string]$Method = "Get",

        [hashtable]$Body
    )

    if (-not $global:PizzaHubHeaders) {
        throw "Authentication missing. Run Connect-PizzaHubVendor first."
    }

    $requestParams = @{
        Uri     = "$global:PizzaHubBaseUrl$Path"
        Method  = $Method
        Headers = $global:PizzaHubHeaders
    }

    if ($PSBoundParameters.ContainsKey("Body")) {
        $requestParams.Body = $Body | ConvertTo-Json -Depth 10
        $requestParams.ContentType = "application/json"
    }

    try {
        Invoke-RestMethod @requestParams
    }
    catch {
        if ($_.Exception.Response -and
            [int]$_.Exception.Response.StatusCode -eq 401) {
            Write-Host "JWT expired. Refreshing token..." -ForegroundColor Yellow
            Refresh-PizzaHubToken
            $requestParams.Headers = $global:PizzaHubHeaders
            Invoke-RestMethod @requestParams
        }
        else {
            throw
        }
    }
}

Write-Host "PizzaHub API testing helpers loaded." -ForegroundColor Cyan
