#include "Modules/ModuleManager.h"
IMPLEMENT_PRIMARY_GAME_MODULE(FDefaultGameModuleImpl, Acceptance, "Acceptance");
#if WITH_DEV_AUTOMATION_TESTS
#include "Misc/AutomationTest.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "GameFramework/Actor.h"
#include "Kismet/GameplayStatics.h"
#include "CheckpointSave.h"
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FCheckpointTest,"GameCrafter.Acceptance.CheckpointPersistence",EAutomationTestFlags::EditorContext|EAutomationTestFlags::EngineFilter)
bool FCheckpointTest::RunTest(const FString& Parameters) {
    const FString Slot="GameCrafterAcceptance_"+FGuid::NewGuid().ToString(); auto* Save=NewObject<UCheckpointSave>(); Save->Health=37; Save->Position=FVector(2,3,4);
    TestTrue(TEXT("checkpoint saved"),UGameplayStatics::SaveGameToSlot(Save,Slot,0)); auto* Loaded=Cast<UCheckpointSave>(UGameplayStatics::LoadGameFromSlot(Slot,0)); TestNotNull(TEXT("checkpoint loaded"),Loaded);
    if(Loaded) { TestEqual(TEXT("health restored"),Loaded->Health,37); TestEqual(TEXT("position restored"),Loaded->Position,FVector(2,3,4)); }
    TestTrue(TEXT("checkpoint removed"),UGameplayStatics::DeleteGameInSlot(Slot,0)); return true;
}
IMPLEMENT_SIMPLE_AUTOMATION_TEST(FActorTest,"GameCrafter.Acceptance.ActorLifecycle",EAutomationTestFlags::EditorContext|EAutomationTestFlags::EngineFilter)
bool FActorTest::RunTest(const FString& Parameters) {
    UWorld* World=NewObject<UWorld>(GetTransientPackage()); TestNotNull(TEXT("world created"),World); if(!World) return false;
    World->WorldType=EWorldType::Game; World->InitializeNewWorld(UWorld::InitializationValues().AllowAudioPlayback(false).CreatePhysicsScene(false).CreateNavigation(false).CreateAISystem(false).ShouldSimulatePhysics(false).SetTransactional(false));
    GEngine->CreateNewWorldContext(EWorldType::Game).SetCurrentWorld(World);
    AActor* First=World->SpawnActor<AActor>(); TestNotNull(TEXT("first actor spawned"),First); if(First) { TestTrue(TEXT("actor destruction accepted"),First->Destroy()); TestTrue(TEXT("actor marked destroying"),First->IsActorBeingDestroyed()); }
    AActor* Second=World->SpawnActor<AActor>(); TestNotNull(TEXT("respawn actor spawned"),Second); TestTrue(TEXT("new lifecycle instance"),Second!=First); GEngine->DestroyWorldContext(World); World->DestroyWorld(false); return true;
}
#endif
