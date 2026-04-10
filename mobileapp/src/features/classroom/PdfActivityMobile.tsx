import React, { memo, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Linking,
    Image,
    ActivityIndicator
} from 'react-native';
import storage from '../../lib/storage';
import { FileText, Download, ExternalLink } from 'lucide-react-native';
import { Colors, Shadows, Spacing } from '../../theme';
import { BRIDGE_BASE_URL } from '../../api/client';

interface PdfProps {
    content: {
        pdf_id?: number;
        pdf_download_url?: string;
        pdf_title?: string;
    };
    onAction: (action: string, data?: any) => void;
    gameState?: any;
    isTeacher?: boolean;
}

export default function PdfActivityMobile({ content, onAction, gameState, isTeacher }: PdfProps) {
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        storage.getItemAsync('access_token').then(setToken);
    }, []);

    const title = content.pdf_title || 'Document';
    const url = content.pdf_download_url;
    const currentPage = gameState?.page || 1;

    const handleOpen = () => {
        if (url) Linking.openURL(url);
    };

    // Use the new render endpoint
    const previewUrl = token && content.pdf_id
        ? `${BRIDGE_BASE_URL}/api/curriculum/pdfs/${content.pdf_id}/preview/${currentPage}/?token=${token}`
        : null;

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.header}>
                    <View style={styles.iconBox}>
                        <FileText size={20} color="#F59E0B" />
                    </View>
                    <View>
                        <Text style={styles.title}>PDF Document</Text>
                        <Text style={styles.sub}>{isTeacher ? 'Teacher Control' : 'View Mode'}</Text>
                    </View>
                </View>

                <View style={styles.docInfo}>
                    {previewUrl ? (
                        <View style={styles.previewContainer}>
                            <Image
                                source={{ uri: previewUrl }}
                                style={styles.previewImage}
                                resizeMode="contain"
                                onLoadStart={() => setLoading(true)}
                                onLoadEnd={() => setLoading(false)}
                            />
                            {loading && (
                                <ActivityIndicator style={styles.loader} color="#F59E0B" />
                            )}
                        </View>
                    ) : (
                        <FileText size={48} color="#E2E8F0" />
                    )}
                    <Text style={styles.docTitle}>{title}</Text>
                    {!isTeacher && (
                        <Text style={styles.pageIndicator}>Teacher is viewing page {currentPage}</Text>
                    )}
                </View>

                {isTeacher && (
                    <View style={styles.teacherControls}>
                        <TouchableOpacity style={styles.pageBtn} onPress={() => onAction('page_change', { page: currentPage - 1 })}>
                            <Text style={styles.pageBtnText}>Prev</Text>
                        </TouchableOpacity>
                        <Text style={styles.currPage}>{currentPage}</Text>
                        <TouchableOpacity style={styles.pageBtn} onPress={() => onAction('page_change', { page: currentPage + 1 })}>
                            <Text style={styles.pageBtnText}>Next</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        ...Shadows.md,
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 40,
        width: '100%',
    },
    iconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#FFFBEB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1E293B',
    },
    sub: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600',
    },
    docInfo: {
        alignItems: 'center',
        gap: 15,
        marginBottom: 40,
    },
    docTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#334155',
        textAlign: 'center',
    },
    pageIndicator: {
        fontSize: 12,
        color: '#F59E0B',
        fontWeight: '600',
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 10,
    },
    actions: {
        width: '100%',
        gap: 15,
    },
    openBtn: {
        flexDirection: 'row',
        backgroundColor: '#F59E0B',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadows.sm,
    },
    openBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 16,
    },
    hint: {
        fontSize: 11,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 16,
    },
    teacherControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        marginTop: 30,
    },
    pageBtn: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        backgroundColor: '#F1F5F9',
        borderRadius: 8,
    },
    pageBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    },
    currPage: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1E293B',
    },
    previewContainer: {
        width: '100%',
        aspectRatio: 1.414, // A4 aspect ratio 
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    loader: {
        position: 'absolute',
    }
});
