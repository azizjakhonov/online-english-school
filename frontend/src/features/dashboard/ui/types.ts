export interface BannerDTO {
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
