extends SceneTree

var failures := 0

func _initialize() -> void:
	call_deferred("run_checks")

func check(condition: bool, label: String) -> void:
	if condition:
		print("PASS ", label)
	else:
		failures += 1
		push_error("FAIL " + label)

func run_checks() -> void:
	root.size = Vector2i(960, 640)
	await process_frame
	var scene = load("res://main.tscn").instantiate()
	root.add_child(scene)
	scene.set_process(false)
	check(scene.collected.count(true) == 0, "initial counter is zero")
	for index in scene.lanterns.size():
		scene.player = scene.lanterns[index]
		scene._process(0.0)
		check(scene.collected.count(true) == index + 1, "collect lantern %d" % (index + 1))
		scene._process(0.0)
		check(scene.collected.count(true) == index + 1, "lantern cannot be counted twice")
	var reset := InputEventKey.new()
	reset.physical_keycode = KEY_R
	reset.keycode = KEY_R
	reset.pressed = true
	Input.parse_input_event(reset)
	Input.flush_buffered_events()
	await process_frame
	scene._process(0.0)
	check(scene.collected.count(true) == 0, "R resets collectibles")
	check(scene.player == Vector2(120, 320), "R resets player position")
	var release := InputEventKey.new()
	release.physical_keycode = KEY_R
	release.keycode = KEY_R
	release.pressed = false
	Input.parse_input_event(release)
	Input.flush_buffered_events()
	await process_frame
	Input.action_press("ui_right")
	scene._process(0.25)
	check(scene.player.x > 120, "movement input moves player")
	scene._process(100.0)
	check(scene.player.x <= scene.get_viewport_rect().size.x - 20, "room boundary clamps movement")
	Input.action_release("ui_right")
	print("Lantern Workshop acceptance failures: ", failures)
	quit(0 if failures == 0 else 1)
