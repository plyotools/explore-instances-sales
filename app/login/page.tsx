'use client';

  import { useState, useEffect } from 'react';
  import { KeyRound, AlertCircle, Loader2 } from 'lucide-react';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
  import { Alert, AlertDescription } from '@/components/ui/alert';

  export default function LoginPage() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState('');

    const getBasePath = () => {
      if (typeof window === 'undefined') return '';
      // On GitHub Pages the app runs under /explore-instances-sales
      return window.location.pathname.startsWith('/explore-instances-sales') ? '/explore-instances-sales' : '';
    };

    useEffect(() => {
      // Set last updated timestamp on client only
      setLastUpdated(new Date().toLocaleString());

      // Check if already authenticated
      if (typeof window !== 'undefined' && window.localStorage.getItem('sales_showcase_auth') === 'true') {
        const basePath = getBasePath();
        window.location.replace(basePath + '/instances');
      }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      // Simple client-side auth
      if (password === 'plyo-2026') {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('sales_showcase_auth', 'true');
        }
        const basePath = getBasePath();
        window.location.replace(basePath + '/instances');
      } else {
        setError('Invalid password');
        setLoading(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A082D] p-4 font-sans">
        <div className="w-full max-w-[420px]">
          <Card className="bg-[#0A082D] border-white/10 shadow-2xl overflow-hidden">
            <CardHeader className="text-center pt-8 pb-4">
              <div className="flex justify-center mb-6">
                <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-40 h-40">
                  <g transform="translate(29.78, 23.36) scale(0.4)">
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M61.687 2.98383L89.9321 19.2787C96.8348 23.261 101.088 30.6242 101.088 38.5932V71.1572C101.088 79.1262 96.8348 86.4894 89.9321 90.4717L14.1712 134.179C7.8717 137.813 0 133.267 0 125.994V95.2474C0 87.9749 7.87171 83.4286 14.1712 87.0628L42.4969 103.404C45.0827 104.896 48.314 103.03 48.314 100.044V64.4972C48.314 59.3403 45.5618 54.5753 41.0949 51.9983L11.9546 35.1869C5.6516 31.5507 5.65161 22.454 11.9546 18.8178L39.4006 2.98383C46.2968 -0.994612 54.7909 -0.994608 61.687 2.98383Z"
                      fill="none"
                      stroke="#8027F4"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="650"
                      strokeDashoffset="650"
                      id="path3BallsAlt"
                    >
                      <animate attributeName="stroke-dashoffset" values="650;0;650" dur="3.7s" repeatCount="indefinite" calcMode="spline" keySplines="0.25 0.1 0.25 1; 0.25 0.1 0.25 1" />
                      <animate attributeName="stroke-width" values="3.5;1.5;6;2;5.5;1.8;4.5;2.5;3.5" dur="3.7s" keyTimes="0;0.125;0.25;0.375;0.5;0.625;0.75;1" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1" />
                    </path>
                    <g>
                      <circle cx="0" cy="0" r="4" fill="#8027F4" />
                      <animateMotion dur="3.7s" repeatCount="indefinite" calcMode="spline" keySplines="0.1 0.1 0.9 0.9; 0.1 0.1 0.9 0.9" keyPoints="0;1;0" keyTimes="0;0.5;1">
                        <mpath href="#path3BallsAlt" />
                      </animateMotion>
                    </g>
                    <g>
                      <circle cx="0" cy="0" r="3.5" fill="#8027F4" />
                      <animateMotion dur="3.7s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1; 0.4 0 0.2 1" keyPoints="1;0;1" keyTimes="0;0.5;1">
                        <mpath href="#path3BallsAlt" />
                      </animateMotion>
                    </g>
                    <g>
                      <circle cx="0" cy="0" r="3" fill="#8027F4" />
                      <animateMotion dur="3.7s" repeatCount="indefinite" calcMode="spline" keySplines="0.7 0 0.3 1; 0.7 0 0.3 1" keyPoints="0;1;0" keyTimes="0;0.5;1">
                        <mpath href="#path3BallsAlt" />
                      </animateMotion>
                    </g>
                  </g>
                </svg>
              </div>
              <CardTitle className="text-2xl text-white font-bold tracking-tight mb-2">
                Plyo Explore
              </CardTitle>
              {lastUpdated && (
                <div className="text-xs text-white/40 mt-2">
                  Last updated: {lastUpdated}
                </div>
              )}
            </CardHeader>
            <CardContent className="pb-8">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-[#1F1D4D] border-white/10 text-white placeholder:text-white/30 h-12 focus:ring-[#8027F4] focus:border-[#8027F4] transition-all"
                    autoFocus
                  />
                  <KeyRound className="absolute right-3 top-3.5 h-5 w-5 text-white/20" />
                </div>

                {error && (
                  <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full bg-[#8027F4] hover:bg-[#6c1fd1] text-white h-12 text-base font-semibold transition-all active:scale-[0.98]"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    'Login'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  