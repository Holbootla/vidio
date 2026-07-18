mod support;

use domain::ProfilePreferences;
use support::Harness;

const MANIFEST: &str = r#"{
    "id": "org.streams",
    "version": "1.0.0",
    "name": "Streams",
    "types": ["movie"],
    "resources": ["stream", "subtitles"]
}"#;

async fn setup() -> (Harness, domain::UserId, domain::ProfileId) {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    h.addon_client
        .insert("https://addon.example.com/manifest.json", MANIFEST);
    h.addon()
        .install(
            user.user.id,
            user.profile.id,
            "https://addon.example.com/manifest.json",
        )
        .await
        .unwrap();
    (h, user.user.id, user.profile.id)
}

#[tokio::test]
async fn resolves_and_classifies_streams() {
    let (h, user_id, profile_id) = setup().await;
    h.addon_client.insert(
        "https://addon.example.com/stream/movie/tt1.json",
        r#"{"streams":[
            {"name":"HD","url":"https://cdn.example.com/a.mp4"},
            {"name":"Torrent","infoHash":"abc123"},
            {"name":"HLS","url":"http://cdn.example.com/b.m3u8","behaviorHints":{"notWebReady":true}}
        ]}"#,
    );

    let resolution = h
        .playback()
        .resolve_streams(user_id, profile_id, "movie", "tt1")
        .await
        .unwrap();
    assert_eq!(resolution.streams.len(), 3);

    let direct = &resolution.streams[0];
    assert_eq!(direct.kind, "url");
    assert!(direct.is_web_ready);
    assert!(direct.supported);

    let torrent = &resolution.streams[1];
    assert_eq!(torrent.kind, "torrent");
    assert!(!torrent.supported);

    let hls = &resolution.streams[2];
    assert_eq!(hls.kind, "url");
    assert!(!hls.is_web_ready);
}

#[tokio::test]
async fn hide_p2p_preference_filters_torrents() {
    let (h, user_id, profile_id) = setup().await;
    h.profile()
        .update_preferences(
            user_id,
            profile_id,
            ProfilePreferences {
                hide_p2p_streams: true,
                ..ProfilePreferences::default()
            },
        )
        .await
        .unwrap();
    h.addon_client.insert(
        "https://addon.example.com/stream/movie/tt1.json",
        r#"{"streams":[
            {"url":"https://cdn.example.com/a.mp4"},
            {"infoHash":"abc123"}
        ]}"#,
    );

    let resolution = h
        .playback()
        .resolve_streams(user_id, profile_id, "movie", "tt1")
        .await
        .unwrap();
    assert_eq!(resolution.streams.len(), 1);
    assert_eq!(resolution.streams[0].kind, "url");
}

#[tokio::test]
async fn duplicate_urls_are_deduplicated() {
    let (h, user_id, profile_id) = setup().await;
    h.addon_client.insert(
        "https://addon.example.com/stream/movie/tt1.json",
        r#"{"streams":[
            {"url":"https://cdn.example.com/same.mp4"},
            {"url":"https://cdn.example.com/same.mp4"}
        ]}"#,
    );

    let resolution = h
        .playback()
        .resolve_streams(user_id, profile_id, "movie", "tt1")
        .await
        .unwrap();
    assert_eq!(resolution.streams.len(), 1);
}

#[tokio::test]
async fn resolves_subtitles() {
    let (h, user_id, profile_id) = setup().await;
    h.addon_client.insert(
        "https://addon.example.com/subtitles/movie/tt1.json",
        r#"{"subtitles":[{"id":"1","url":"https://cdn.example.com/en.srt","lang":"en"}]}"#,
    );

    let resolution = h
        .playback()
        .resolve_subtitles(user_id, profile_id, "movie", "tt1")
        .await
        .unwrap();
    assert_eq!(resolution.subtitles.len(), 1);
    assert_eq!(resolution.subtitles[0].subtitle.lang, "en");
}

#[tokio::test]
async fn no_capable_addon_yields_empty_result() {
    let (h, user_id, profile_id) = setup().await;
    // A series id is requested but the add-on only declares the movie type.
    let resolution = h
        .playback()
        .resolve_streams(user_id, profile_id, "series", "tt1")
        .await
        .unwrap();
    assert!(resolution.streams.is_empty());
    assert!(resolution.warnings.is_empty());
}
