extends Node2D

var player := Vector2(120, 320)
var lanterns: Array[Vector2] = [Vector2(320, 200), Vector2(540, 420), Vector2(800, 250)]
var collected: Array[bool] = [false, false, false]

func _process(delta: float) -> void:
	if Input.is_physical_key_pressed(KEY_R):
		player = Vector2(120, 320)
		collected = [false, false, false]
	else:
		player += Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down") * 240.0 * delta
		var viewport := get_viewport_rect().size
		player = player.clamp(Vector2(20, 100), viewport - Vector2(20, 20))
		for index in lanterns.size():
			if player.distance_to(lanterns[index]) < 26.0:
				collected[index] = true
	queue_redraw()

func _draw() -> void:
	var count := collected.count(true)
	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(30, 40), "Lantern Workshop - documentation fixture", HORIZONTAL_ALIGNMENT_LEFT, -1, 24)
	draw_string(font, Vector2(30, 75), "Arrow keys: move | R: reset | Lanterns: %d/3" % count, HORIZONTAL_ALIGNMENT_LEFT, -1, 20)
	for index in lanterns.size():
		if not collected[index]:
			draw_circle(lanterns[index], 14, Color(1.0, 0.77, 0.25))
	draw_circle(player, 12, Color(0.71, 1.0, 0.22))
	if count == 3:
		draw_string(font, Vector2(300, 580), "All lanterns collected! Press R to reset.", HORIZONTAL_ALIGNMENT_LEFT, -1, 22)
