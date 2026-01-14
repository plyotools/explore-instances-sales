'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { Play, Search } from 'lucide-react';
import { PanoramaViewer } from '@/app/components/panorama-viewer';

const PLACEHOLDER_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idHJhbnNwYXJlbnQiLz48L3N2Zz4=';

interface ShowcaseInstance {
  id: string;
  uuid: string;
  name: string;
  client: string;
  link: string;
  type: 'Showroom' | 'Unit Finder';
  features: string[];
  image: string | null;
  isShowcase?: boolean;
  status?: string;
}

// Overview Animation Component for Unit Finder
function OverviewAnimation({ projectId, basePath = '', totalDuration = 720 }: { projectId: string; basePath?: string; totalDuration?: number }) {
  const [images, setImages] = useState<string[]>([]);
  const [imageData, setImageData] = useState<Array<{ local: string; cdn: string; fileName: string }>>([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [allPreloaded, setAllPreloaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [hasWebPAnimation, setHasWebPAnimation] = useState(false);
  const [firstImage, setFirstImage] = useState<string | null>(null);
  const isHoveredRef = useRef(false);
  const imageElementRef = useRef<HTMLImageElement>(null);
  const preloadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadImages = async () => {
      try {
        const webpUrl = `${basePath}/previews/${projectId}.webp`;
        fetch(webpUrl, { method: 'HEAD', signal: AbortSignal.timeout(800) })
          .then(res => setHasWebPAnimation(res.ok))
          .catch(() => setHasWebPAnimation(false));
        
        const jsonUrl = `${basePath}/projects/${projectId}/overview-images.json`;
        setImagesLoaded(true);
        
        try {
          const response = await fetch(jsonUrl, { signal: AbortSignal.timeout(5000) });
          if (response?.ok) {
            const data = await response.json();
            const sortedData = [...data].sort((a: any, b: any) => a.index - b.index);
            const imageDataArray = sortedData.map((item: any) => {
              let fileExt = 'webp';
              if (item.fileName) {
                if (item.fileName.endsWith('.jpg') || item.fileName.endsWith('.jpeg')) {
                  fileExt = 'jpg';
                } else if (item.fileName.endsWith('.webp')) {
                  fileExt = 'webp';
                }
              }
              const fileName = item.fileName || `${item.texture}_LOD3.${fileExt}`;
              const localPath = `${basePath}/projects/${projectId}/overview/${fileName}`;
              const cdnUrl = item.url;
              return { local: localPath, cdn: cdnUrl, fileName };
            });
            setImageData(imageDataArray);
            const filteredUrls = imageDataArray
              .map((item: any) => item.cdn || item.local)
              .filter((url: string) => url);
            setImages(filteredUrls);
            if (imageDataArray.length > 0) {
              const firstImageUrl = imageDataArray[0]?.cdn || imageDataArray[0]?.local || filteredUrls[0];
              if (firstImageUrl) {
                setFirstImage(firstImageUrl);
              }
            }
          }
        } catch {
          setImagesLoaded(true);
        }
      } catch (error: any) {
        setImagesLoaded(true);
      }
    };

    loadImages();
  }, [projectId, basePath]);

  useEffect(() => {
    if (!imagesLoaded || imageData.length === 0) return;

    let loadedCount = 0;
    const totalImages = images.length;
    const validImages: string[] = [];

    const checkAndPreloadImages = async () => {
      const checkPromises = imageData.map(async (item: any) => {
        try {
          const localResponse = await fetch(item.local, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(1000)
          }).catch(() => null);
          if (localResponse?.ok) {
            validImages.push(item.local);
            return true;
          }
        } catch {
          // Local failed, try CDN
        }
        
        if (item.cdn) {
          try {
            const cdnResponse = await fetch(item.cdn, { 
              method: 'HEAD',
              signal: AbortSignal.timeout(1000)
            }).catch(() => null);
            if (cdnResponse?.ok) {
              validImages.push(item.cdn);
              return true;
            }
          } catch {
            // CDN also failed
          }
        }
        return false;
      });

      await Promise.all(checkPromises);

      validImages.forEach((url) => {
        const img = new window.Image();
        img.decoding = 'sync';
        const promise = new Promise<void>((resolve) => {
          img.onload = () => {
            preloadedImagesRef.current.set(url, img);
            loadedCount++;
            if (loadedCount === validImages.length) {
              setAllPreloaded(true);
            }
            resolve();
          };
          img.onerror = () => {
            loadedCount++;
            if (loadedCount === validImages.length) {
              setAllPreloaded(true);
            }
            resolve();
          };
        });
        img.src = url;
      });
    };

    checkAndPreloadImages();
  }, [images, imagesLoaded]);

  useEffect(() => {
    if (hasWebPAnimation || images.length === 0 || !allPreloaded) return;

    if (!isHovered) {
      const img = imageElementRef.current;
      if (img && firstImage) {
        img.src = firstImage;
      }
      return;
    }

    const verifiedImages = Array.from(preloadedImagesRef.current.keys());
    
    if (verifiedImages.length === 0) {
      return;
    }

    const intervalTime = (totalDuration * 1000) / verifiedImages.length;
    let frameIndex = 0;
    const startTime = performance.now();
    let animationId: number;
    
    const animate = (currentTime: number) => {
      if (!isHoveredRef.current) {
        return;
      }
      
      const elapsed = currentTime - startTime;
      const newFrameIndex = Math.floor((elapsed / intervalTime) % verifiedImages.length);
      
      if (newFrameIndex !== frameIndex) {
        frameIndex = newFrameIndex;
        const img = imageElementRef.current;
        if (img && verifiedImages[frameIndex]) {
          const preloaded = preloadedImagesRef.current.get(verifiedImages[frameIndex]);
          if (preloaded && preloaded.complete && preloaded.naturalWidth > 0) {
            img.src = verifiedImages[frameIndex];
          }
        }
      }
      
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [images, allPreloaded, totalDuration, isHovered, hasWebPAnimation, firstImage]);

  const initialImageSrc = firstImage || (imageData.length > 0 ? (imageData[0]?.cdn || imageData[0]?.local) : null) || images[0] || null;
  const webpUrl = hasWebPAnimation ? `${basePath}/previews/${projectId}.webp` : null;

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => {
        setIsHovered(true);
        isHoveredRef.current = true;
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        isHoveredRef.current = false;
      }}
      className="w-full h-full relative overflow-hidden"
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
    >
      {initialImageSrc && (
        <img
          ref={imageElementRef}
          src={initialImageSrc}
          alt="Overview"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.src.startsWith('data:') && imageData.length > 0) {
              const currentIndex = imageData.findIndex((item: any) => 
                item.local === target.src || item.cdn === target.src
              );
              
              if (currentIndex >= 0 && imageData[currentIndex]?.cdn && target.src === imageData[currentIndex].local) {
                target.src = imageData[currentIndex].cdn;
                return;
              }
              
              for (let i = 0; i < imageData.length; i++) {
                if (imageData[i]?.cdn && imageData[i].cdn !== target.src) {
                  target.src = imageData[i].cdn;
                  return;
                }
              }
              
              if (currentIndex >= 0 && currentIndex < imageData.length - 1) {
                const nextItem = imageData[currentIndex + 1];
                target.src = nextItem?.cdn || nextItem?.local || images[currentIndex + 1];
                return;
              }
              
              for (let i = 0; i < imageData.length; i++) {
                if (i !== currentIndex && imageData[i]?.local && imageData[i].local !== target.src) {
                  target.src = imageData[i].local;
                  return;
                }
              }
            }
            
            target.style.opacity = '0.3';
          }}
          onLoad={() => {
            const target = imageElementRef.current;
            if (target) {
              target.style.display = 'block';
            }
          }}
          className="w-full h-full object-cover absolute inset-0"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            imageRendering: 'auto',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
            willChange: 'contents',
            WebkitBackfaceVisibility: 'hidden',
            WebkitTransform: 'translateZ(0)',
            opacity: isHovered && webpUrl ? 0 : 1,
            transition: 'opacity 0.15s ease-in-out',
            pointerEvents: 'none',
          }}
          loading="eager"
          decoding="async"
        />
      )}
      {webpUrl && (
        <img
          src={webpUrl}
          alt="Overview Animation"
          className="w-full h-full object-cover absolute inset-0"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            imageRendering: 'auto',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
            willChange: 'auto',
            WebkitBackfaceVisibility: 'hidden',
            WebkitTransform: 'translateZ(0)',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
            pointerEvents: 'none',
          }}
          loading="eager"
          decoding="async"
        />
      )}
      {!initialImageSrc && (
        <div className="w-full h-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }} />
      )}
    </div>
  );
}

// Card Image Renderer
function CardImageRenderer({ instance, basePath = '', index }: { instance: ShowcaseInstance; basePath?: string; index: number }) {
  const projectId = instance.uuid || instance.id;
  const [hasSampleImage, setHasSampleImage] = useState<boolean | null>(null);
  const [hasOverviewImages, setHasOverviewImages] = useState<boolean | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const imageSrc = instance.image 
    ? (basePath && !instance.image.startsWith(basePath) 
        ? `${basePath}${instance.image}` 
        : instance.image)
    : null;

  useEffect(() => {
    if (instance.type === 'Unit Finder' && hasOverviewImages === null) {
      const overviewImagesJsonPath = basePath 
        ? `${basePath}/projects/${projectId}/overview-images.json`
        : `/projects/${projectId}/overview-images.json`;
      
      if (index < 12) {
        fetch(overviewImagesJsonPath, { signal: AbortSignal.timeout(1000) })
          .then(res => setHasOverviewImages(res.ok))
          .catch(() => setHasOverviewImages(false));
      } else {
        const timer = setTimeout(() => {
          fetch(overviewImagesJsonPath, { signal: AbortSignal.timeout(1000) })
            .then(res => setHasOverviewImages(res.ok))
            .catch(() => setHasOverviewImages(false));
        }, (index - 12) * 50);
        return () => clearTimeout(timer);
      }
    } else if (instance.type !== 'Unit Finder') {
      setHasOverviewImages(false);
    }
  }, [projectId, basePath, index, instance.type]);

  useEffect(() => {
    if (instance.type === 'Showroom' && hasSampleImage === null) {
      const sampleWebpSrc = basePath 
        ? `${basePath}/projects/${projectId}/sample/sample.webp`
        : `/projects/${projectId}/sample/sample.webp`;
      const sampleJpgSrc = basePath 
        ? `${basePath}/projects/${projectId}/sample/sample.jpg`
        : `/projects/${projectId}/sample/sample.jpg`;
      
      if (index < 12) {
        Promise.race([
          fetch(sampleWebpSrc, { method: 'HEAD', signal: AbortSignal.timeout(800) }),
          fetch(sampleJpgSrc, { method: 'HEAD', signal: AbortSignal.timeout(800) })
        ])
        .then(res => setHasSampleImage(res.ok))
        .catch(() => {
          fetch(sampleJpgSrc, { method: 'HEAD', signal: AbortSignal.timeout(800) })
            .then(res => setHasSampleImage(res.ok))
            .catch(() => setHasSampleImage(false));
        });
      } else {
        const timer = setTimeout(() => {
          Promise.race([
            fetch(sampleWebpSrc, { method: 'HEAD', signal: AbortSignal.timeout(800) }),
            fetch(sampleJpgSrc, { method: 'HEAD', signal: AbortSignal.timeout(800) })
          ])
          .then(res => setHasSampleImage(res.ok))
          .catch(() => {
            fetch(sampleJpgSrc, { method: 'HEAD', signal: AbortSignal.timeout(800) })
              .then(res => setHasSampleImage(res.ok))
              .catch(() => setHasSampleImage(false));
          });
        }, (index - 12) * 50);
        return () => clearTimeout(timer);
      }
    } else if (instance.type !== 'Showroom') {
      setHasSampleImage(false);
    }
  }, [projectId, basePath, index, instance.type]);

  const isUnitFinder = instance.type === 'Unit Finder' || hasOverviewImages === true;
  const isShowroom = instance.type === 'Showroom';

  if (isUnitFinder) {
    return (
      <div ref={cardRef} className="w-full h-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
        <OverviewAnimation projectId={projectId} basePath={basePath} totalDuration={3} />
      </div>
    );
  }

  if (isShowroom && hasSampleImage !== false) {
    const sampleWebpSrc = basePath 
      ? `${basePath}/projects/${projectId}/sample/sample.webp`
      : `/projects/${projectId}/sample/sample.webp`;
    const sampleJpgSrc = basePath 
      ? `${basePath}/projects/${projectId}/sample/sample.jpg`
      : `/projects/${projectId}/sample/sample.jpg`;
    
    return (
      <div ref={cardRef} className="w-full h-full relative" style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
        <PanoramaViewer
          imageSrc={sampleWebpSrc}
          fallbackSrc={sampleJpgSrc}
          autoRotate={true}
          rotationSpeed={45}
          priority={0}
          disableInteraction={false}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }

  const transparentPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idHJhbnNwYXJlbnQiLz48L3N2Zz4=';

  return (
    <div ref={cardRef} className="w-full h-full relative" style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={instance.name}
          className="w-full h-full object-cover"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
          loading={index < 3 ? 'eager' : 'lazy'}
          decoding="async"
          onError={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target as HTMLImageElement;
            if (!target.src.startsWith('data:')) {
              target.src = transparentPlaceholder;
              target.onerror = null;
            }
          }}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
          <div className="text-gray-500 text-xs mb-2">
            <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            No preview available
          </div>
        </div>
      )}
    </div>
  );
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<ShowcaseInstance[]>([]);
  const [filteredInstances, setFilteredInstances] = useState<ShowcaseInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [includedFeatures, setIncludedFeatures] = useState<string[]>([]);
  const [excludedFeatures, setExcludedFeatures] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const basePath = process.env.NODE_ENV === 'production' ? '/explore' : '';

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.add('dark');
    }
    
    const loadInstances = async () => {
      try {
        const response = await fetch('/metadata.json');
        if (response.ok) {
          const data = await response.json();
          setInstances(data);
          setFilteredInstances(data);
        }
      } catch (error) {
        console.error('Failed to load instances:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInstances();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!loading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [loading]);

  useEffect(() => {
    let filtered = [...instances];

    if (typeFilter !== 'all') {
      filtered = filtered.filter(instance => instance.type === typeFilter);
    }

    if (clientFilter !== 'all') {
      filtered = filtered.filter(instance => instance.client === clientFilter);
    }

    if (includedFeatures.length > 0) {
      filtered = filtered.filter(instance => 
        includedFeatures.every(feature => instance.features.includes(feature))
      );
    }

    if (excludedFeatures.length > 0) {
      filtered = filtered.filter(instance => 
        !excludedFeatures.some(feature => instance.features.includes(feature))
      );
    }

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(instance => 
        instance.name?.toLowerCase().includes(query) ||
        instance.client?.toLowerCase().includes(query) ||
        instance.id?.toLowerCase().includes(query) ||
        instance.uuid?.toLowerCase().includes(query)
      );
    }

    setFilteredInstances(filtered);
  }, [instances, typeFilter, clientFilter, includedFeatures, excludedFeatures, debouncedSearchQuery]);

  const clients = useMemo(() => {
    const uniqueClients = Array.from(new Set(instances.map(i => i.client).filter(Boolean)));
    return uniqueClients.sort();
  }, [instances]);

  const featureOptions = useMemo(() => {
    if (!instances || instances.length === 0) {
      return [];
    }
    
    const featureSet = new Set<string>();
    instances.forEach(instance => {
      if (instance.features && Array.isArray(instance.features) && instance.features.length > 0) {
        instance.features.forEach(feature => {
          if (feature && typeof feature === 'string' && feature.trim().length > 0) {
            featureSet.add(feature.trim());
          }
        });
      }
    });

    if (featureSet.size === 0) {
      return [];
    }

    return Array.from(featureSet)
      .sort((a, b) => a.localeCompare(b))
      .map(feature => {
        const count = instances.filter(i => 
          i.features && Array.isArray(i.features) && i.features.includes(feature)
        ).length;
        return { value: feature, label: `${feature} (${count})` };
      });
  }, [instances]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="w-full px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Explore Instances</h1>
          <p className="text-muted-foreground">Browse all available instances</p>
        </div>

        <div className="flex flex-wrap gap-4 mb-6 items-center">
          <div className="flex items-center gap-2 relative">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search instances..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[250px] pl-9"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Type:</span>
            <Select value={typeFilter || 'all'} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Showroom">Showroom</SelectItem>
                <SelectItem value="Unit Finder">Unit Finder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Client:</span>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client} value={client || ''}>
                    {client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {featureOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Features:</span>
              {featureOptions.length > 0 && (
                <>
                  <MultiSelect
                    options={featureOptions}
                    selected={includedFeatures}
                    onChange={setIncludedFeatures}
                    placeholder="Include Features"
                    searchPlaceholder="Search features..."
                    className="w-[200px]"
                  />
                  <MultiSelect
                    options={featureOptions}
                    selected={excludedFeatures}
                    onChange={setExcludedFeatures}
                    placeholder="Exclude Features"
                    searchPlaceholder="Search features..."
                    className="w-[200px]"
                  />
                </>
              )}
            </div>
          )}

          {(typeFilter !== 'all' || clientFilter !== 'all' || includedFeatures.length > 0 || excludedFeatures.length > 0 || searchQuery) && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setTypeFilter('all');
                setClientFilter('all');
                setIncludedFeatures([]);
                setExcludedFeatures([]);
                setSearchQuery('');
              }}
            >
              Clear Filters
            </Button>
          )}

          <div className="ml-auto text-sm text-muted-foreground">
            Showing {filteredInstances.length} of {instances.length} instances
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {filteredInstances.map((instance, index) => (
            <Card 
              key={instance.id} 
              className="overflow-hidden hover:shadow-lg transition-shadow"
              style={{ backgroundColor: 'transparent' }}
            >
              <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: 'transparent' }}>
                <CardImageRenderer instance={instance} basePath={basePath} index={index} />
              </div>
              <CardHeader>
                <div className="flex items-center justify-between gap-2 mb-2">
                  {instance.client && (
                    <CardDescription className="mb-0">{instance.client}</CardDescription>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    {instance.type && (
                      <Badge variant="secondary">
                        {instance.type}
                      </Badge>
                    )}
                    {instance.isShowcase && (
                      <Badge variant="default" className="bg-purple-600 hover:bg-purple-700">
                        Showcase
                      </Badge>
                    )}
                    {instance.status && (
                      <Badge 
                        variant="outline"
                        className={
                          instance.status === 'Public'
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }
                      >
                        {instance.status}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardTitle className="text-lg truncate mb-2" style={{ maxWidth: '100%' }}>
                  {instance.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (instance.link) {
                        window.open(instance.link, '_blank', 'noopener,noreferrer');
                      }
                    }}
                    title="Open project"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {filteredInstances.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No instances found</p>
          </div>
        )}
      </div>
    </div>
  );
}
