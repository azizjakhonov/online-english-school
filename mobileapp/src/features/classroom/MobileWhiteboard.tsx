import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, PanResponder, Dimensions, Image } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { Colors } from '../../theme';

interface Shape {
    id: string;
    type: 'pencil' | 'rect' | 'circle';
    points: number[];
    color: string;
    strokeWidth: number;
}

interface MobileWhiteboardProps {
    gameState?: any;
    onAction: (action: string, data: any) => void;
    backgroundImage?: string;
}

export default function MobileWhiteboard({ gameState, onAction, backgroundImage }: MobileWhiteboardProps) {
    const [shapes, setShapes] = useState<Shape[]>([]);
    const [currentShape, setCurrentShape] = useState<Shape | null>(null);
    const containerRef = useRef<View>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // Sync from remote (web)
    useEffect(() => {
        if (!gameState || !gameState.shapes) return;

        // Convert fractional coordinates back to local pixels
        const denormalized = gameState.shapes.map((s: any) => ({
            ...s,
            points: s.points.map((p: number, i: number) =>
                i % 2 === 0 ? p * dimensions.width : p * dimensions.height
            )
        }));

        setShapes(denormalized);
    }, [gameState, dimensions]);

    const onLayout = (event: any) => {
        const { width, height } = event.nativeEvent.layout;
        setDimensions({ width, height });
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                const newShape: Shape = {
                    id: Math.random().toString(36).substr(2, 9),
                    type: 'pencil',
                    points: [locationX, locationY],
                    color: Colors.primary,
                    strokeWidth: 3,
                };
                setCurrentShape(newShape);
            },
            onPanResponderMove: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                setCurrentShape((prev: any) => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        points: [...prev.points, locationX, locationY],
                    };
                });
            },
            onPanResponderRelease: () => {
                setCurrentShape((prev: any) => {
                    if (!prev) return null;

                    const finalShape = prev;

                    // Normalize for sync
                    const normalized = {
                        ...finalShape,
                        points: finalShape.points.map((p: number, i: number) =>
                            i % 2 === 0 ? p / dimensions.width : p / dimensions.height
                        )
                    };

                    // Update local state
                    const newShapes = [...shapes, finalShape];
                    setShapes(newShapes);

                    // Sync to remote
                    onAction('draw_event', {
                        shapes: [...shapes, normalized].map(s => s.id === normalized.id ? normalized : s)
                    });

                    return null;
                });
            },
        })
    ).current;

    const renderPath = (shape: Shape) => {
        if (shape.points.length < 2) return null;
        let d = `M ${shape.points[0]} ${shape.points[1]}`;
        for (let i = 2; i < shape.points.length; i += 2) {
            d += ` L ${shape.points[i]} ${shape.points[i + 1]}`;
        }
        return (
            <Path
                key={shape.id}
                d={d}
                stroke={shape.color}
                strokeWidth={shape.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        );
    };

    return (
        <View
            style={styles.container}
            onLayout={onLayout}
            {...panResponder.panHandlers}
        >
            {backgroundImage && (
                <View style={StyleSheet.absoluteFill}>
                    <Image
                        source={{ uri: backgroundImage }}
                        style={styles.backgroundImage}
                        resizeMode="contain"
                    />
                </View>
            )}
            <Svg style={StyleSheet.absoluteFill}>
                <G>
                    {shapes.map(renderPath)}
                    {currentShape && renderPath(currentShape)}
                </G>
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
    }
});
