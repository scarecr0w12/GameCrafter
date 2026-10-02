#include "AcceptanceActor.h"
#include "CheckpointSave.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/PlatformMisc.h"
void AAcceptanceActor::BeginPlay() {
    Super::BeginPlay(); const FString Slot="GameCrafterAcceptance_"+FGuid::NewGuid().ToString(); auto* Save=NewObject<UCheckpointSave>(); Save->Health=73; Save->Position=FVector(4,5,6);
    bool Passed=UGameplayStatics::SaveGameToSlot(Save,Slot,0); auto* Loaded=Cast<UCheckpointSave>(UGameplayStatics::LoadGameFromSlot(Slot,0)); Passed=Passed && Loaded && Loaded->Health==73 && Loaded->Position==FVector(4,5,6); UGameplayStatics::DeleteGameInSlot(Slot,0);
    FFileHelper::SaveStringToFile(Passed?TEXT("{\"passed\":true,\"assertions\":3}"):TEXT("{\"passed\":false}"),*(FPaths::ProjectSavedDir()/TEXT("player-acceptance.json"))); FPlatformMisc::RequestExitWithStatus(false,Passed?0:1);
}
