import React, { useEffect } from "react";
import { toast } from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { CheckCircle, LogOut, Trash2, ArrowLeft, RefreshCw } from "lucide-react";

const LoggedInPage = ({ certificate, userPubKey, setCertificate }) => {
    
    // Check for return URL and redirect if needed
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('returnUrl');
        
        if (returnUrl) {
            // Small delay to let user see the success message
            setTimeout(() => {
                toast.success('Redirecting back to whiskey store...', {
                    duration: 2000,
                });
                window.location.href = decodeURIComponent(returnUrl);
            }, 2000);
        }
    }, []);

    const refreshCertificate = async () => {
        // Clear certificate and force reload
        setCertificate(null);
        localStorage.clear(); // Clear any cached data
        sessionStorage.clear();
        // Force reload to get fresh certificate
        window.location.reload();
    };

    const handleRevoke = async () => {
        if (!certificate) return;

        // Spend the revocation outpoint with the serverWallet
        // After successful redemption delete the certificate from the database
        // and call relinquishCertificate

        const res = await fetch('/delete-certificate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ publicKey: userPubKey, certificate }),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error("Certificate revocation failed:", data);
            toast.error(data.message || "Something failed, please try again");
            return;
        }

        toast.success("Certificate revoked successfully");
        setCertificate(null);
        
        // Redirect to root page after successful revocation
        setTimeout(() => {
            window.location.href = '/';
        }, 1500); // Small delay to let user see the success message
    }

    const handleLogout = () => {
        // Simple logout - just clear the certificate from state
        setCertificate(null);
        toast.success("Logged out successfully");
    }

    const handleReturnToStore = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('returnUrl');
        
        if (returnUrl) {
            window.location.href = decodeURIComponent(returnUrl);
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const returnUrl = urlParams.get('returnUrl');

    return (
        <div className="w-full max-w-md">
            <Card>
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                    </div>
                    <CardTitle>Welcome Back!</CardTitle>
                    <p className="text-muted-foreground">You are successfully logged in with your certificate.</p>
                    {returnUrl && (
                        <p className="text-sm text-blue-600 mt-2">Auto-redirecting to the whiskey store...</p>
                    )}
                </CardHeader>
                <CardContent className="space-y-3">
                    {returnUrl && (
                        <Button 
                            onClick={handleReturnToStore}
                            className="w-full gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Return to Whiskey Store
                        </Button>
                    )}
                    <Button 
                        onClick={refreshCertificate}
                        variant="outline"
                        className="w-full gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Refresh Certificate
                    </Button>
                    <Button 
                        onClick={handleRevoke}
                        variant="destructive"
                        className="w-full gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        Revoke Certificate
                    </Button>
                    <Button 
                        onClick={handleLogout}
                        variant="outline"
                        className="w-full gap-2"
                    >
                        <LogOut className="h-4 w-4" />
                        Logout (Keep Certificate)
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}

export default LoggedInPage;
