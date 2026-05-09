//! Font type / style indexes from Grok (`grok_font_indexes.json`), loaded at compile time.

use glyphon::{Attrs, AttrsOwned, Family, Style, Weight};
use serde::Deserialize;
use std::sync::OnceLock;

static GROK_TERMINAL_ATTRS: OnceLock<AttrsOwned> = OnceLock::new();

#[derive(Debug, Deserialize)]
struct GrokFontIndexes {
    font_types: Vec<FontTypeSpec>,
    font_styles: Vec<FontStyleSpec>,
    ironraw: IronrawPick,
}

#[derive(Debug, Deserialize)]
struct FontTypeSpec {
    id: u8,
    key: String,
    cosmic_family: String,
}

#[derive(Debug, Deserialize)]
struct FontStyleSpec {
    id: u8,
    key: String,
    weight: u16,
    style: String,
}

#[derive(Debug, Deserialize)]
struct IronrawPick {
    font_type_id: u8,
    font_style_id: u8,
}

fn cosmic_family(tag: &str) -> Family<'static> {
    if let Some(name) = tag.strip_prefix("Name:") {
        return Family::Name(leak(name));
    }
    match tag {
        "SansSerif" => Family::SansSerif,
        "Serif" => Family::Serif,
        "Monospace" => Family::Monospace,
        "Cursive" => Family::Cursive,
        "Fantasy" => Family::Fantasy,
        _ => Family::SansSerif,
    }
}

fn leak(s: &str) -> &'static str {
    Box::leak(s.to_string().into_boxed_str())
}

fn cosmic_style(s: &str) -> Style {
    match s {
        "Italic" => Style::Italic,
        "Oblique" => Style::Oblique,
        _ => Style::Normal,
    }
}

fn load_attrs_owned() -> AttrsOwned {
    const JSON: &str = include_str!("../assets/grok_font_indexes.json");
    let idx: GrokFontIndexes =
        serde_json::from_str(JSON).expect("grok_font_indexes.json must be valid");
    let ft = idx
        .font_types
        .iter()
        .find(|t| t.id == idx.ironraw.font_type_id)
        .unwrap_or_else(|| {
            idx.font_types
                .iter()
                .find(|t| t.key == "mono_terminal")
                .expect("grok font_types must include mono_terminal")
        });
    let st = idx
        .font_styles
        .iter()
        .find(|s| s.id == idx.ironraw.font_style_id)
        .unwrap_or_else(|| {
            idx.font_styles
                .iter()
                .find(|s| s.key == "regular")
                .expect("grok font_styles must include regular")
        });
    let base = Attrs::new()
        .family(cosmic_family(&ft.cosmic_family))
        .weight(Weight(st.weight))
        .style(cosmic_style(&st.style));
    AttrsOwned::new(&base)
}

/// Glyphon/cosmic-text attributes for the IronRaw surface: Grok **mono_terminal** + **regular** by default.
pub fn ironraw_terminal_attrs() -> Attrs<'static> {
    GROK_TERMINAL_ATTRS
        .get_or_init(load_attrs_owned)
        .as_attrs()
}
