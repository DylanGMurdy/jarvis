'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export default function SecurityTestPage() {
  const [authToken, setAuthToken] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testEndpoint = async (includeAuth: boolean) => {
    setLoading(true);
    setResponse(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (includeAuth && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/test-security', {
        method: 'GET',
        headers,
      });

      const data = await res.json();
      setResponse({
        status: res.status,
        statusText: res.statusText,
        data,
        headers: includeAuth ? 'With Auth Header' : 'No Auth Header',
      });
    } catch (error) {
      setResponse({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Security Test - Auth Headers</h1>
        <p className="text-muted-foreground">
          Test endpoint security by sending requests with and without authorization headers.
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Authorization Token (Optional)</Label>
              <Input
                id="token"
                type="password"
                placeholder="Enter test token..."
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
              />
            </div>
            
            <div className="flex gap-4">
              <Button 
                onClick={() => testEndpoint(false)}
                disabled={loading}
                variant="destructive"
              >
                {loading ? 'Testing...' : 'Test Without Auth Header'}
              </Button>
              
              <Button 
                onClick={() => testEndpoint(true)}
                disabled={loading}
                variant="default"
              >
                {loading ? 'Testing...' : 'Test With Auth Header'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {response && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Test Results
                {response.data?.vulnerable !== undefined && (
                  <Badge variant={response.data.vulnerable ? "destructive" : "default"}>
                    {response.data.vulnerable ? 'Vulnerable' : 'Secure'}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label>Status Code</Label>
                  <p className={`font-mono ${response.status >= 400 ? 'text-red-500' : 'text-green-500'}`}>
                    {response.status} {response.statusText}
                  </p>
                </div>
                <div>
                  <Label>Request Type</Label>
                  <p className="font-mono">{response.headers}</p>
                </div>
              </div>

              {response.data && (
                <div>
                  <Label>Response Data</Label>
                  <pre className="bg-muted p-3 rounded-md overflow-auto text-xs">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              )}

              {response.error && (
                <Alert>
                  <AlertDescription>
                    Error: {response.error}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Security Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Requests without auth headers should return 401 Unauthorized</p>
              <p>• Requests with invalid auth format should be rejected</p>
              <p>• Empty tokens should not be accepted</p>
              <p>• Valid tokens should grant access to protected resources</p>
              <p>• This is a test endpoint - remove from production</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}