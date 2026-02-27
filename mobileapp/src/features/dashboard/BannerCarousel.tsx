import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    Dimensions,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import client from '../../api/client';
import { Colors, Shadows } from '../../theme';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width * 0.88;
const SLIDE_GAP = 12;
const SNAP_INTERVAL = SLIDE_WIDTH + SLIDE_GAP;

interface BannerDTO {
    id: number;
    name: string;
    placement: string;
    title?: string;
    subtitle?: string;
    cta_text?: string;
    image_web_url?: string;
    image_mobile_url?: string;
    background_color?: string;
    target_type: 'INTERNAL' | 'EXTERNAL';
    target_value: string;
    priority: number;
}

interface BannerCarouselProps {
    placement: 'student_home_top' | 'teacher_home_top' | 'classroom_waiting';
    navigation: any;
    headerSlide?: React.ReactNode;
}


const BannerCarousel: React.FC<BannerCarouselProps> = ({ placement, navigation, headerSlide }) => {
    const [banners, setBanners] = useState<BannerDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                const response = await client.get(`/api/banners/?placement=${placement}&platform=MOBILE`);

                setBanners(response.data);
            } catch (error) {
                console.error('Failed to fetch mobile banners:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchBanners();
    }, [placement]);

    // Combined data: Header Slide first, then Banners
    const allSlides = headerSlide ? ['header', ...banners] : banners;

    useEffect(() => {
        if (allSlides.length <= 1) return;

        timerRef.current = setInterval(() => {
            const nextIndex = (currentIndex + 1) % allSlides.length;
            setCurrentIndex(nextIndex);
            flatListRef.current?.scrollToOffset({
                offset: nextIndex * SNAP_INTERVAL,
                animated: true
            });
        }, 20000);



        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [allSlides.length, currentIndex]);

    const handlePress = (banner: BannerDTO) => {
        if (!banner.target_value) return;
        if (banner.target_type === 'EXTERNAL') {
            Linking.openURL(banner.target_value);
        } else {
            const value = banner.target_value;
            if (value.includes('/student/credits') || value.includes('BuyCredits')) {
                navigation.navigate('BuyCredits');
            } else if (value.includes('/teacher/earnings') || value.includes('TeacherEarnings')) {
                navigation.navigate('TeacherEarnings');
            } else if (value.includes('/settings')) {
                navigation.navigate('Profile');
            } else {
                console.warn('Unknown mobile route mapping for:', value);
            }
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.loading]}>
                <ActivityIndicator color={Colors.primary} />
            </View>
        );
    }

    if (allSlides.length === 0) return null;

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={allSlides}
                keyExtractor={(_, index) => index.toString()}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={SNAP_INTERVAL}
                snapToAlignment="start"
                decelerationRate="fast"
                contentContainerStyle={styles.flatListContent}
                onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
                    setCurrentIndex(index);
                }}
                renderItem={({ item, index }) => {
                    if (item === 'header') {
                        return (
                            <View style={styles.cardWrapper}>
                                {headerSlide}
                            </View>
                        );
                    }

                    const banner = item as BannerDTO;
                    return (
                        <View style={styles.cardWrapper}>
                            <TouchableOpacity
                                activeOpacity={banner.target_value ? 0.9 : 1}
                                onPress={() => handlePress(banner)}
                                disabled={!banner.target_value}
                                style={[
                                    styles.slide,
                                    !banner.image_mobile_url && { backgroundColor: banner.background_color || Colors.primary }
                                ]}
                            >



                                {banner.image_mobile_url && (
                                    <Image
                                        source={{ uri: banner.image_mobile_url }}
                                        style={styles.image}
                                        resizeMode="cover"
                                    />
                                )}
                                <View style={styles.content}>
                                    {banner.title && <Text style={styles.title}>{banner.title}</Text>}
                                    {banner.subtitle && <Text style={styles.subtitle} numberOfLines={2}>{banner.subtitle}</Text>}
                                    {banner.cta_text && (
                                        <View style={styles.cta}>
                                            <Text style={styles.ctaText}>{banner.cta_text}</Text>
                                            <ChevronRight size={14} color={Colors.primary} />
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        </View>
                    );
                }}
            />
            {allSlides.length > 1 && (
                <View style={styles.pagination}>
                    {allSlides.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dot,
                                i === currentIndex ? styles.activeDot : styles.inactiveDot
                            ]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};


const styles = StyleSheet.create({
    container: {
        marginTop: 8,
        height: 180,
    },
    loading: {
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 24,
        borderRadius: 24,
        height: 160,
    },
    flatListContent: {
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    cardWrapper: {
        width: SLIDE_WIDTH,
        height: 160,
        marginRight: SLIDE_GAP,
    },
    slide: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
        justifyContent: 'center',
        ...Shadows.sm,
    },
    image: {
        ...StyleSheet.absoluteFillObject,
        opacity: 1,
    },

    content: {
        padding: 24,
        maxWidth: '80%',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 4,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 12,
    },
    cta: {
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 4,
    },
    ctaText: {
        color: Colors.primary,
        fontSize: 12,
        fontWeight: '800',
    },
    pagination: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    dot: {
        height: 4,
        borderRadius: 2,
    },
    activeDot: {
        width: 16,
        backgroundColor: Colors.primary,
    },
    inactiveDot: {
        width: 4,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
});


export default BannerCarousel;
