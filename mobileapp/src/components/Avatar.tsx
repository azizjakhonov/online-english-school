import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors } from '../theme';

interface AvatarProps {
    url?: string | null;
    name?: string;
    size?: number;
    style?: any;
}

export default function Avatar({
    url,
    name,
    size = 40,
    style,
}: AvatarProps) {
    const [imgError, setImgError] = useState(false);

    const showImage = Boolean(url) && !imgError;
    const initial = (name?.[0] ?? '?').toUpperCase();

    return (
        <View
            style={[
                styles.container,
                { width: size, height: size, borderRadius: size / 2 },
                style,
            ]}
        >
            {showImage ? (
                <Image
                    source={{ uri: url! }}
                    style={styles.image}
                    onError={() => setImgError(true)}
                />
            ) : (
                <View style={styles.fallback}>
                    <Text
                        style={[
                            styles.initial,
                            { fontSize: Math.max(size * 0.38, 10) },
                        ]}
                    >
                        {initial}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    fallback: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    initial: {
        fontWeight: 'bold',
        color: Colors.primary,
    },
});
