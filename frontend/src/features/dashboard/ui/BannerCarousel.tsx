import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../../lib/api';
import type { BannerDTO } from './types';


interface BannerCarouselProps {
    placement: 'student_home_top' | 'teacher_home_top' | 'classroom_waiting';
}


const BannerCarousel: React.FC<BannerCarouselProps> = ({ placement }) => {
    const [banners, setBanners] = useState<BannerDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const navigate = useNavigate();
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);


    useEffect(() => {
        const fetchBanners = async () => {
            try {
                const response = await api.get(`/api/banners/?placement=${placement}&platform=WEB`);

                setBanners(response.data);
            } catch (error) {
                console.error('Failed to fetch banners:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchBanners();
    }, [placement]);

    useEffect(() => {
        if (banners.length <= 1 || isPaused) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % banners.length);
        }, 20000);




        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [banners, isPaused]);

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % banners.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
    };

    const handleClick = (banner: BannerDTO) => {
        if (!banner.target_value) return;
        if (banner.target_type === 'EXTERNAL') {
            window.open(banner.target_value, '_blank');
        } else {
            const path = banner.target_value.startsWith('/') ? banner.target_value : `/${banner.target_value}`;
            navigate(path);
        }
    };

    if (loading) {
        return (
            <div className="w-full h-48 bg-gray-100 animate-pulse rounded-2xl mb-6 flex items-center justify-center">
                <span className="text-gray-400">Loading campaigns...</span>
            </div>
        );
    }

    if (banners.length === 0) return null;

    return (
        <div
            className="relative w-full overflow-hidden rounded-2xl mb-6 group"

            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
                {banners.map((banner) => (
                    <div
                        key={banner.id}
                        className={`w-full shrink-0 aspect-[2/1] md:aspect-[4/1] relative ${banner.target_value ? 'cursor-pointer' : 'cursor-default'}`}
                        onClick={() => banner.target_value && handleClick(banner)}
                        style={!banner.image_web_url ? { backgroundColor: banner.background_color || '#4A90E2' } : {}}
                    >



                        {banner.image_web_url && (
                            <img
                                src={banner.image_web_url}
                                alt={banner.name}
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        )}


                        <div className="absolute inset-0 p-8 flex flex-col justify-center max-w-2xl">
                            {banner.title && (
                                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight">
                                    {banner.title}
                                </h2>
                            )}
                            {banner.subtitle && (
                                <p className="text-white/90 text-sm md:text-base mb-4 line-clamp-2">
                                    {banner.subtitle}
                                </p>
                            )}
                            {banner.cta_text && (
                                <button className="bg-white text-blue-600 px-6 py-2 rounded-full font-semibold text-sm w-fit hover:bg-opacity-90 transition-all active:scale-95 shadow-lg">
                                    {banner.cta_text}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {banners.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-md p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); handleNext(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-md p-2 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <ChevronRight size={24} />
                    </button>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        {banners.map((_, idx) => (
                            <button
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                                className={`h-1.5 rounded-full transition-all ${currentIndex === idx ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
                                    }`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default BannerCarousel;
