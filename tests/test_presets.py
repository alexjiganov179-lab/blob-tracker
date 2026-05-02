from processing.presets import load_presets, default_params


def test_load_presets_returns_named_dict():
    presets = load_presets()
    assert "Neon Debug" in presets
    assert "Minimal White" in presets
    # Each preset is a full params dict
    p = presets["Neon Debug"]
    assert "contour" in p
    assert "trail" in p


def test_default_params_has_all_sections():
    p = default_params()
    for section in ["detection", "contour", "fill", "bbox", "trail", "centroid", "labels"]:
        assert section in p