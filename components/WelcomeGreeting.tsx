import { site } from "@/lib/site";

/*
  Personal greeting.
  - Visitor not signed in:  "Welcome to RSN, where shopping is made easy."
  - Signed-in customer:     "Hi Ada, welcome to RSN, where shopping is made easy."

  Right now nobody can sign in, so pages pass firstName={null}.
  When Google sign-in is added, we will pass the customer's real first name.
  It takes its colour from the area around it.
*/
export default function WelcomeGreeting({ firstName }: { firstName?: string | null }) {
  const rest = `welcome to ${site.shortName}, where shopping is made easy.`;

  return (
    <p className="text-sm sm:text-base">
      {firstName ? (
        <>
          Hi <span className="font-bold">{firstName}</span>, {rest}
        </>
      ) : (
        <>Welcome to {site.shortName}, where shopping is made easy.</>
      )}
    </p>
  );
}
