# CryoAtlas Q&A



## Why did we build CryoAtlas?

Researchers need reliable data to train model-building methods and a common benchmark to compare them fairly. Preparing map–structure–sequence pairs is time-consuming, and comparisons are difficult when studies use different test sets and metrics. CryoAtlas provides both a curated dataset and a shared evaluation protocol, making it easier to develop new methods and measure progress.

## What are the limitations of the current release?

The current release focuses on protein chains. We check the consistency of maps, structures, and sequences, but do not repair errors within deposited PDB models, such as incorrect residue assignments or stereochemical defects. Filtering and the selection of targets shared by all methods may favor easier or better-resolved examples. Some training and test entries also have high sequence similarity, which needs to be considered when assessing generalization.

## What comes next for CryoAtlas?

We plan to release cropped density maps ready for AI training. Removing excess space around each assembly would reduce storage and could make both training and inference more efficient, while retaining the molecular context and correct map–coordinate alignment. We also hope to extend the dataset and benchmark to protein–nucleic-acid complexes, ligands, and, where suitable data are available, different conformational states. On the evaluation side, we aim to develop algorithms that handle incomplete models and complex assemblies more reliably.

## How do AlphaFold and density-based model building complement each other?

An AlphaFold model can give researchers a useful starting structure with a plausible fold and good local geometry. It still needs to be fitted to the experimental map, checked and rebuilt in tools such as Coot, and refined in Phenix. Even when the overall fold is correct, domains or subunits may be misplaced, and loops or side chains may not match the observed density. Correcting these differences can still require considerable expert effort.

Methods such as ModelAngelo and CryoAtom2 build more directly from the density, helping recover the conformation present in the experiment. Their main difficulty is weak or poorly resolved density, where they may leave gaps or make tracing errors. Their models also need refinement to improve geometry.

A useful comparison should consider the accuracy and completeness of the resulting model, its fit to the map, and how much manual work remains. Future workflows could combine AlphaFold's structural priors with density-based building, with agents helping coordinate fitting, validation, and rebuilding.

## Why is protein identification important, and how can CryoAtlas help?

Protein identification (PI) determines which proteins occupy the density in a cryo-EM map when their sequences are not known in advance. It becomes particularly important for samples purified from native sources, co-purified complexes, and in situ studies, where the molecular composition may be uncertain. In these settings, identifying the components is essential to understanding the structure and its biological role.

ModelAngelo and CryoAtom provide useful starting points: they infer residue-type probabilities from density, convert them into HMM profiles, and search protein sequence databases. The identified sequences then guide further model building.

CryoAtlas provides paired maps, atomic structures, and sequence annotations that could support training and evaluation for PI. Its known protein identities and chain assignments can serve as reference labels, while target sequences are withheld from model inputs during evaluation. Adding defined candidate databases and identification-specific metrics would allow tests of protein identity and chain assignment across different map qualities and levels of sequence similarity.

## How can CryoAtlas support structure-based drug discovery?

Cryo-EM structures help researchers understand where compounds bind, how they interact with a target, and which protein conformations they stabilize. These details can guide compound design and help explain differences in activity or selectivity. Obtaining them requires accurate atomic models, including reliable placement of residues around the binding site.

CryoAtlas supports this step by providing data to train automated model-building methods and a common benchmark to assess their accuracy and agreement with experimental density. Better methods could reduce manual rebuilding and make structural information more readily available for drug-discovery studies. The current release evaluates protein reconstruction; extending it to ligands and binding-site accuracy would make the connection to drug design more direct.
